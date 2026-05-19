/**
 * Slack message branding for Flight School.
 *
 * Wraps an admin-authored body with a branded header so recipients always see
 * the message is from Flight School. Applied at exactly one chokepoint
 * (sendSlackDM) — never at the call site or inside drafts.
 */

const BRAND_NAME = 'Flight School';
const BRAND_LINE = `_${BRAND_NAME}_`;
const DIVIDER = '———';
const DEFAULT_EMOJI = ':rocket:';

const EMOJI_BY_KIND: Record<string, string> = {
  slack: ':rocket:',
  email: ':envelope:',
  survey: ':clipboard:',
  welcome: ':wave:',
  reminder: ':alarm_clock:',
  celebration: ':tada:',
};

export interface FormatSlackMessageOptions {
  title: string;
  body: string;
  kind?: string;
}

function emojiFor(kind?: string): string {
  if (!kind) return DEFAULT_EMOJI;
  return EMOJI_BY_KIND[kind.toLowerCase()] ?? DEFAULT_EMOJI;
}

// Idempotency guard: detect the BRAND_LINE in the first few lines.
function isAlreadyDecorated(text: string): boolean {
  const head = text.split('\n', 4);
  return head.some((line) => line.trim() === BRAND_LINE);
}

export function formatSlackMessage(opts: FormatSlackMessageOptions): string {
  const { title, body, kind } = opts;
  if (isAlreadyDecorated(body)) return body;
  const emoji = emojiFor(kind);
  return `${emoji} *${title}*\n${BRAND_LINE}\n${DIVIDER}\n${body}`;
}
