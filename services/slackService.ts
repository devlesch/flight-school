import { supabase } from '../lib/supabase';

/**
 * Send a Slack DM to a user via the slack-proxy edge function.
 */
export async function sendSlackDM(
  email: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('slack-proxy', {
    body: { action: 'send_dm', email, text },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as { success: boolean; error?: string };
}
