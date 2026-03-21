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

    // 2. Verify admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse({ success: false, error: `Profile lookup failed: ${profileError?.message || 'not found'}` });
    }

    if (profile.role !== 'Admin') {
      return jsonResponse({ success: false, error: `Admin role required (current: ${profile.role})` });
    }

    // 3. Parse request body
    const { action, email, text } = await req.json();

    if (action !== 'send_dm') {
      return jsonResponse({ success: false, error: `Unknown action: ${action}` });
    }

    if (!email || !text) {
      return jsonResponse({ success: false, error: 'email and text are required' });
    }

    // 4. Call VIBE MCP slack_send_dm
    const mcpSecret = Deno.env.get('MCP_SECRET_KEY');
    if (!mcpSecret) {
      return jsonResponse({ success: false, error: 'MCP secret not configured' });
    }

    const mcpResponse = await fetch('https://industriousvibe.vercel.app/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mcpSecret}`,
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
  } catch (err) {
    return jsonResponse({ success: false, error: `Unexpected: ${(err as Error).message}` });
  }
});
