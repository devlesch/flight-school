import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface LessonlyAssignment {
  assignable_id: number;
  assignable_type: string;
  status: string;
  completed_at: string | null;
  score: number | null;
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
    const { email, lessonIds } = await req.json() as { email: string; lessonIds: number[] };

    if (!email || !Array.isArray(lessonIds) || lessonIds.length === 0) {
      return jsonResponse({ success: false, error: 'email and lessonIds[] are required' });
    }

    // 3. Read Lessonly credentials
    const apiKey = Deno.env.get('LESSONLY_API_KEY');
    const subdomain = Deno.env.get('LESSONLY_SUBDOMAIN');

    if (!apiKey || !subdomain) {
      return jsonResponse({ success: false, error: 'Lessonly credentials not configured' });
    }

    const basicAuth = btoa(`${subdomain}:${apiKey}`);
    const baseUrl = `https://api.lessonly.com/api/v1.1`;

    // 4. Find Lessonly user by email
    const normalizedEmail = email.toLowerCase();
    const userResponse = await fetch(
      `${baseUrl}/users?filter[email]=${encodeURIComponent(normalizedEmail)}`,
      { headers: { Authorization: `Basic ${basicAuth}` } }
    );

    if (!userResponse.ok) {
      return jsonResponse({
        success: false,
        error: `Lessonly API error: ${userResponse.status}`,
        lessonly_user_found: false,
        statuses: {},
      });
    }

    const userData = await userResponse.json();
    const lessonlyUsers = userData.users || [];

    if (lessonlyUsers.length === 0) {
      // User not found in Lessonly — return empty statuses
      const notFoundStatuses: Record<number, { status: string; completed_at: string | null }> = {};
      for (const id of lessonIds) {
        notFoundStatuses[id] = { status: 'not_found', completed_at: null };
      }
      return jsonResponse({
        success: true,
        lessonly_user_found: false,
        statuses: notFoundStatuses,
      });
    }

    const lessonlyUserId = lessonlyUsers[0].id;

    // 5. Fetch user assignments
    const assignmentsResponse = await fetch(
      `${baseUrl}/users/${lessonlyUserId}/assignments`,
      { headers: { Authorization: `Basic ${basicAuth}` } }
    );

    if (!assignmentsResponse.ok) {
      return jsonResponse({
        success: false,
        error: `Lessonly assignments API error: ${assignmentsResponse.status}`,
        lessonly_user_found: true,
        statuses: {},
      });
    }

    const assignmentsData = await assignmentsResponse.json();
    const assignments: LessonlyAssignment[] = assignmentsData.assignments || assignmentsData || [];

    // 6. Map lessonIds to assignment statuses
    const assignmentMap = new Map<number, LessonlyAssignment>();
    for (const assignment of assignments) {
      if (assignment.assignable_type === 'Lesson') {
        assignmentMap.set(assignment.assignable_id, assignment);
      }
    }

    const statuses: Record<number, { status: string; completed_at: string | null; score: number | null }> = {};
    for (const lessonId of lessonIds) {
      const assignment = assignmentMap.get(lessonId);
      if (assignment) {
        statuses[lessonId] = {
          status: assignment.status,
          completed_at: assignment.completed_at,
          score: assignment.score ?? null,
        };
      } else {
        statuses[lessonId] = { status: 'not_found', completed_at: null, score: null };
      }
    }

    return jsonResponse({
      success: true,
      lessonly_user_found: true,
      statuses,
    });
  } catch (err) {
    return jsonResponse({ success: false, error: `Unexpected: ${(err as Error).message}` });
  }
});
