import { supabase } from '../lib/supabase';

/**
 * Send a Slack DM to a user via the slack-proxy edge function.
 * Logs the message to slack_messages table on success.
 */
export async function sendSlackDM(
  email: string,
  text: string
): Promise<{ success: boolean; error?: string; logged?: boolean }> {
  const { data, error } = await supabase.functions.invoke('slack-proxy', {
    body: { action: 'send_dm', email, text },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as { success: boolean; error?: string };
  if (!result.success) {
    return result;
  }

  // Log the sent message to slack_messages table
  let logged = false;
  try {
    // Get current user as sender
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Look up recipient by email
      const { data: recipient } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (recipient) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: logError } = await (supabase as any)
          .from('slack_messages')
          .insert({
            sender_id: user.id,
            recipient_id: (recipient as { id: string }).id,
            message_text: text,
            channel: 'slack',
          });

        if (logError) {
          console.warn('Message sent but failed to log:', logError.message);
        } else {
          logged = true;
        }
      }
    }
  } catch (err) {
    console.warn('Message sent but logging failed:', err);
  }

  return { success: true, logged };
}
