import { describe, it, expect, vi } from 'vitest';

// `slackService` imports `lib/supabase` at module-load time. Mock it so the
// test file doesn't need real Supabase env vars to evaluate the import.
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

import { buildSlackDeepLink } from '../../../services/slackService';

describe('buildSlackDeepLink', () => {
  it('returns Slack app_redirect URL with encodeURIComponent applied for a valid email containing "+"', () => {
    const email = 'melissa.zelko+test@industriousoffice.com';
    const result = buildSlackDeepLink(email);

    const expectedPrimary = `https://industrious.slack.com/app_redirect?email=${encodeURIComponent(
      email
    )}`;
    expect(result.primary).toBe(expectedPrimary);
    // Sanity: encoding really did transform the `+` so the literal `+` is not in the URL.
    expect(result.primary).toContain('%2B');
    expect(result.primary).not.toMatch(/\+test@/);
  });

  it('returns a mailto: fallback equal to the original email for valid input', () => {
    const email = 'someone@industriousoffice.com';
    const result = buildSlackDeepLink(email);
    expect(result.fallback).toBe(`mailto:${email}`);
  });

  it('treats an email containing a space as invalid and returns an empty pair', () => {
    // Spaces are not allowed in a basic email shape; the helper should reject this.
    const result = buildSlackDeepLink('melissa zelko@x.com');
    expect(result).toEqual({ primary: '', fallback: '' });
  });

  it('returns empty pair for an empty string', () => {
    expect(buildSlackDeepLink('')).toEqual({ primary: '', fallback: '' });
  });

  it('returns empty pair for whitespace-only input', () => {
    expect(buildSlackDeepLink('   ')).toEqual({ primary: '', fallback: '' });
  });

  it('returns empty pair for invalid emails', () => {
    expect(buildSlackDeepLink('notanemail')).toEqual({ primary: '', fallback: '' });
    expect(buildSlackDeepLink('foo@')).toEqual({ primary: '', fallback: '' });
    expect(buildSlackDeepLink('@bar')).toEqual({ primary: '', fallback: '' });
    // Missing TLD dot — basic shape requires `<something>.<something>` after `@`.
    expect(buildSlackDeepLink('foo@bar')).toEqual({ primary: '', fallback: '' });
  });
});
