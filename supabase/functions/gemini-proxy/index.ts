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

    // 2. Read Gemini API key
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return jsonResponse({ success: false, error: 'Gemini API key not configured' });
    }

    // 3. Parse request — accepts model, contents, and optional config
    const { model, contents, config } = await req.json() as {
      model: string;
      contents: unknown;
      config?: Record<string, unknown>;
    };

    if (!model || !contents) {
      return jsonResponse({ success: false, error: 'model and contents are required' });
    }

    // 4. Call Gemini API via REST
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Build the request body for the Gemini REST API
    // Handle both string and structured content formats
    let parts: unknown[];
    if (typeof contents === 'string') {
      parts = [{ text: contents }];
    } else if (typeof contents === 'object' && contents !== null && 'parts' in contents) {
      parts = (contents as { parts: unknown[] }).parts;
    } else {
      parts = [{ text: String(contents) }];
    }

    const geminiBody: Record<string, unknown> = {
      contents: [{ parts }],
    };

    // Add generation config if provided
    if (config) {
      const generationConfig: Record<string, unknown> = {};
      if (config.responseMimeType) generationConfig.responseMimeType = config.responseMimeType;
      if (config.responseSchema) generationConfig.responseSchema = config.responseSchema;
      if (Object.keys(generationConfig).length > 0) {
        geminiBody.generationConfig = generationConfig;
      }
    }

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return jsonResponse({
        success: false,
        error: `Gemini API error ${geminiResponse.status}: ${errorText.slice(0, 300)}`,
      });
    }

    const geminiResult = await geminiResponse.json();

    // Extract text from the response
    const candidates = geminiResult.candidates || [];
    const text = candidates[0]?.content?.parts?.[0]?.text || '';

    return jsonResponse({ success: true, text });
  } catch (err) {
    return jsonResponse({ success: false, error: `Unexpected: ${(err as Error).message}` });
  }
});
