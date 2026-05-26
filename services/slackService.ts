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
      // Look up recipient by email — case-insensitive because Workday-imported
      // emails preserve case (`Liam.Kinna@…`) and Postgres `=` on TEXT is
      // case-sensitive. `.ilike` matches across cases; `.maybeSingle()` returns
      // `{ data: null, error: null }` on 0 rows instead of `.single()`'s error.
      const { data: recipient } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle();

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

/** Base URL of the Industrious Slack workspace. */
export const SLACK_WORKSPACE_URL = 'https://industriousoffice.slack.com';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Trim and validate an email against a basic email shape.
 *
 * @returns The trimmed email, or `null` if the input is not a string, is
 *          empty/whitespace-only, or does not match a basic email shape.
 */
function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') {
    return null;
  }
  const trimmed = email.trim();
  return trimmed !== '' && EMAIL_SHAPE.test(trimmed) ? trimmed : null;
}

/**
 * Build a `mailto:` link for an email address.
 *
 * Pure function — no Supabase, no async, no network.
 *
 * @returns A `mailto:` URL, or `''` if the email is empty/invalid.
 */
export function buildMailtoLink(email: string): string {
  const valid = normalizeEmail(email);
  return valid ? `mailto:${valid}` : '';
}

/**
 * Resolve a deep link that opens a Slack DM with the person at `email`.
 *
 * Slack has no client-side URL that opens a DM straight from an email
 * address — `app_redirect?email=` is for opening Slack *apps* and shows an
 * "App Not Found" page. So this resolves the recipient's Slack user ID via
 * the `slack-proxy` edge function (`users.lookupByEmail`) and builds an
 * `app_redirect` DM link.
 *
 * If the lookup fails for any reason — no `SLACK_BOT_TOKEN` configured, the
 * person isn't on Slack, a network error — it falls back to the workspace
 * home URL, which still opens the correct Slack instance.
 *
 * @returns A Slack URL, or `''` only when `email` is empty/invalid.
 */
export async function resolveSlackDmUrl(email: string): Promise<string> {
  const valid = normalizeEmail(email);
  if (!valid) {
    return '';
  }

  const workspaceHome = `${SLACK_WORKSPACE_URL}/`;
  try {
    const { data, error } = await supabase.functions.invoke('slack-proxy', {
      body: { action: 'lookup_user', email: valid },
    });

    if (error) {
      return workspaceHome;
    }

    const result = data as { success: boolean; userId?: string; teamId?: string };
    if (!result?.success || !result.userId) {
      return workspaceHome;
    }

    const team = result.teamId ? `&team=${encodeURIComponent(result.teamId)}` : '';
    return `${SLACK_WORKSPACE_URL}/app_redirect?channel=${encodeURIComponent(result.userId)}${team}`;
  } catch {
    return workspaceHome;
  }
}
