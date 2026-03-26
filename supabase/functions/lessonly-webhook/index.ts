import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify webhook secret (optional — configured in Lessonly webhook settings)
    const webhookSecret = Deno.env.get('LESSONLY_WEBHOOK_SECRET');
    if (webhookSecret) {
      const authHeader = req.headers.get('Authorization') || '';
      if (authHeader !== webhookSecret) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
    }

    // 2. Parse Lessonly webhook payload
    const payload = await req.json();

    // Extract user email and lesson ID from the payload
    // Lessonly sends: { user: { id, name, email, ... }, lesson: { id, title, ... }, completed_date, score_percent, ... }
    const userEmail = (payload.user?.email || payload.email || '').toLowerCase();
    const lessonId = payload.lesson?.id || payload.lesson_id;
    const completedDate = payload.completed_date || payload.completed_at || new Date().toISOString();

    if (!userEmail || !lessonId) {
      return jsonResponse({ success: false, error: 'Missing user email or lesson ID in payload' }, 400);
    }

    // 3. Use service role client to write to DB (no user auth needed for webhook)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 4. Find user by email in profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (profileError || !profile) {
      // User not in Flight School — ignore silently (might be a Lessonly-only user)
      return jsonResponse({ success: true, skipped: true, reason: 'User not found in Flight School' });
    }

    // 5. Find training module by lesson ID in the link field
    const { data: modules, error: modulesError } = await supabase
      .from('training_modules')
      .select('id, link')
      .eq('type', 'LESSONLY');

    if (modulesError || !modules || modules.length === 0) {
      return jsonResponse({ success: true, skipped: true, reason: 'No LESSONLY modules found' });
    }

    // Match lesson ID from the link URL
    const matchingModule = modules.find((m: { id: string; link: string }) => {
      if (!m.link) return false;
      const match = m.link.match(/lessonly\.com\/lesson\/(\d+)/);
      return match && parseInt(match[1], 10) === lessonId;
    });

    if (!matchingModule) {
      return jsonResponse({ success: true, skipped: true, reason: `No module matches lesson ID ${lessonId}` });
    }

    // 6. Check if user_modules record exists
    const { data: existing } = await supabase
      .from('user_modules')
      .select('id, completed')
      .eq('user_id', profile.id)
      .eq('module_id', matchingModule.id)
      .single();

    if (existing?.completed) {
      // Already marked complete — nothing to do
      return jsonResponse({ success: true, already_completed: true });
    }

    if (existing) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('user_modules')
        .update({ completed: true, completed_at: completedDate })
        .eq('id', existing.id);

      if (updateError) {
        return jsonResponse({ success: false, error: `Update failed: ${updateError.message}` }, 500);
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('user_modules')
        .insert({
          user_id: profile.id,
          module_id: matchingModule.id,
          completed: true,
          completed_at: completedDate,
        });

      if (insertError) {
        return jsonResponse({ success: false, error: `Insert failed: ${insertError.message}` }, 500);
      }
    }

    return jsonResponse({
      success: true,
      user: userEmail,
      lesson_id: lessonId,
      module_id: matchingModule.id,
      action: existing ? 'updated' : 'created',
    });
  } catch (err) {
    return jsonResponse({ success: false, error: `Unexpected: ${(err as Error).message}` }, 500);
  }
});
