import { supabase } from '../lib/supabase';
import { formatSlackMessage } from './slackMessageFormatter';

export interface SendSlackDMOptions {
  title: string;
  kind?: string;
}

/**
 * Send a Slack DM to a user via the slack-proxy edge function.
 *
 * When `opts.title` is provided, the body is wrapped with a Flight School
 * branded header (banner + runway divider + kind-emoji bold title) before being
 * sent to Slack. The slack_messages row always stores the RAW caller-provided
 * body so the history side-panel does not visually duplicate the header.
 */
export async function sendSlackDM(
  email: string,
  body: string,
  opts?: SendSlackDMOptions
): Promise<{ success: boolean; error?: string; logged?: boolean }> {
  const wireText = opts?.title
    ? formatSlackMessage({ title: opts.title, body, kind: opts.kind })
    : body;

  const { data, error } = await supabase.functions.invoke('slack-proxy', {
    body: { action: 'send_dm', email, text: wireText },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as { success: boolean; error?: string };
  if (!result.success) {
    return result;
  }

  // Log the sent message to slack_messages table — RAW body, not decorated.
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
            message_text: body,
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
