/**
 * Slack message branding for Flight School.
 *
 * Wraps an admin-authored body with a branded header so recipients always see
 * the message is from Flight School. Applied at exactly one chokepoint
 * (sendSlackDM) — never at the call site or inside drafts.
 *
 * Layout: a fixed Flight School banner, a runway divider, a kind-emoji + bold
 * title line, a blank line, then the verbatim body.
 */

const BRAND_BANNER = ':airplane: ✦ *FLIGHT SCHOOL* ✦ :airplane:';
const DIVIDER = '━━━━━━━━━━━━━━━━━━━';
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

// Idempotency guard: detect the brand banner as the first line.
function isAlreadyDecorated(text: string): boolean {
  return text.split('\n', 1)[0].trim() === BRAND_BANNER;
}

export function formatSlackMessage(opts: FormatSlackMessageOptions): string {
  const { title, body, kind } = opts;
  if (isAlreadyDecorated(body)) return body;
  const emoji = emojiFor(kind);
  return `${BRAND_BANNER}\n${DIVIDER}\n${emoji} *${title}*\n\n${body}`;
}
