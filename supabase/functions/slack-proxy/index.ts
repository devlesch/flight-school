import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Pull a Slack user ID (and team ID, when present) out of an MCP tool result.
 *
 * The `slack_lookup_user` tool's exact return shape is not pinned down, so
 * this checks the shapes an MCP tool commonly uses: `structuredContent`, a
 * JSON payload inside a text content block, or a bare `U…` user ID in a text
 * content block.
 */
// deno-lint-ignore no-explicit-any
function extractSlackUser(result: any): { userId?: string; teamId?: string } {
  // deno-lint-ignore no-explicit-any
  const pickFrom = (obj: any): { userId?: string; teamId?: string } => {
    if (!obj || typeof obj !== 'object') return {};
    const user = obj.user && typeof obj.user === 'object' ? obj.user : obj;
    const userId =
      user.id ?? user.user_id ?? user.userId ?? obj.id ?? obj.user_id ?? obj.userId;
    const teamId =
      user.team_id ?? user.teamId ?? obj.team_id ?? obj.teamId;
    return {
      userId: typeof userId === 'string' ? userId : undefined,
      teamId: typeof teamId === 'string' ? teamId : undefined,
    };
  };

  if (!result) return {};

  // 1. structuredContent
  const structured = pickFrom(result.structuredContent);
  if (structured.userId) return structured;

  // 2. text content blocks
  if (Array.isArray(result.content)) {
    for (const block of result.content) {
      if (block?.type !== 'text' || typeof block.text !== 'string') continue;
      const text = block.text.trim();

      // 2a. JSON payload
      try {
        const fromJson = pickFrom(JSON.parse(text));
        if (fromJson.userId) return fromJson;
      } catch {
        // not JSON — fall through
      }

      // 2b. bare Slack user ID
      const match = text.match(/\b(U[A-Z0-9]{6,})\b/);
      if (match) return { userId: match[1] };
    }
  }

  return {};
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Authenticate caller via Supabase JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ success: false, error: 'Missing authorization header' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ success: false, error: `Auth failed: ${authError?.message || 'no user'}` });
    }

    // 2. Parse request body
    const { action, email, text } = await req.json();

    // 3a. lookup_user — resolve an email to a Slack user ID via the VIBE MCP
    //     `slack_lookup_user` tool. Available to any authenticated user (the
    //     Support FAB uses this so a new hire can open a DM with their
    //     manager). Read-only, low-risk.
    if (action === 'lookup_user') {
      if (!email) {
        return jsonResponse({ success: false, error: 'email is required' });
      }

      const mcpSecret = Deno.env.get('MCP_SECRET_KEY');
      if (!mcpSecret) {
        return jsonResponse({ success: false, error: 'MCP secret not configured' });
      }

      const writeSecret = Deno.env.get('FLIGHTSCHOOL_SYSTEM_WRITE_SECRET');
      if (!writeSecret) {
        return jsonResponse({ success: false, error: 'Vibe system write secret not configured' });
      }

      const mcpResponse = await fetch('https://industriousvibe.vercel.app/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mcpSecret}`,
          'X-Vibe-System-Client': 'flightschool',
          'X-Vibe-System-Write-Secret': writeSecret,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'slack_lookup_user',
            arguments: { email },
          },
        }),
      });

      if (!mcpResponse.ok) {
        const body = await mcpResponse.text();
        return jsonResponse({ success: false, error: `MCP HTTP ${mcpResponse.status}: ${body.slice(0, 200)}` });
      }

      const mcpResult = await mcpResponse.json();

      if (mcpResult.error) {
        return jsonResponse({ success: false, error: mcpResult.error.message || 'MCP error' });
      }

      const { userId, teamId } = extractSlackUser(mcpResult.result);
      if (!userId) {
        return jsonResponse({ success: false, error: 'Could not resolve a Slack user for that email' });
      }

      return jsonResponse({ success: true, userId, teamId });
    }

    // 3b. send_dm — Admin-only. Sends a Slack DM via the VIBE MCP.
    if (action === 'send_dm') {
      // Verify admin via the is_admin column (the single source of truth for
      // the only manually-stored status — `role` is now derived/meaningless).
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        return jsonResponse({ success: false, error: `Profile lookup failed: ${profileError?.message || 'not found'}` });
      }

      if (profile.is_admin !== true) {
        return jsonResponse({ success: false, error: 'Admin role required' });
      }

      if (!email || !text) {
        return jsonResponse({ success: false, error: 'email and text are required' });
      }

      const mcpSecret = Deno.env.get('MCP_SECRET_KEY');
      if (!mcpSecret) {
        return jsonResponse({ success: false, error: 'MCP secret not configured' });
      }

      const writeSecret = Deno.env.get('FLIGHTSCHOOL_SYSTEM_WRITE_SECRET');
      if (!writeSecret) {
        return jsonResponse({ success: false, error: 'Vibe system write secret not configured' });
      }

      const mcpResponse = await fetch('https://industriousvibe.vercel.app/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mcpSecret}`,
          'X-Vibe-System-Client': 'flightschool',
          'X-Vibe-System-Write-Secret': writeSecret,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'slack_send_dm',
            arguments: { user_email: email, text },
          },
        }),
      });

      if (!mcpResponse.ok) {
        const body = await mcpResponse.text();
        return jsonResponse({ success: false, error: `MCP HTTP ${mcpResponse.status}: ${body.slice(0, 200)}` });
      }

      const mcpResult = await mcpResponse.json();

      // MCP JSON-RPC: check for error or tool-level error in result
      if (mcpResult.error) {
        return jsonResponse({ success: false, error: mcpResult.error.message || 'MCP error' });
      }

      // The tool result content may indicate failure (e.g. user not found on Slack)
      const content = mcpResult.result?.content;
      if (Array.isArray(content)) {
        const textContent = content.find((c: { type: string }) => c.type === 'text');
        if (textContent?.text?.toLowerCase().includes('error') || textContent?.text?.toLowerCase().includes('could not')) {
          return jsonResponse({ success: false, error: textContent.text });
        }
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: `Unknown action: ${action}` });
  } catch (err) {
    return jsonResponse({ success: false, error: `Unexpected: ${(err as Error).message}` });
  }
});
