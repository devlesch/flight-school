import { describe, it, expect, vi, beforeEach } from 'vitest';

// `slackService` imports `lib/supabase` at module-load time. Mock it so the
// test file doesn't need real Supabase env vars to evaluate the import.
// `vi.hoisted` keeps `mockInvoke` available inside the hoisted mock factory.
const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
    functions: { invoke: mockInvoke },
  },
}));

import {
  buildMailtoLink,
  resolveSlackDmUrl,
  SLACK_WORKSPACE_URL,
} from '../../../services/slackService';

describe('buildMailtoLink', () => {
  it('returns a mailto: link for a valid email', () => {
    expect(buildMailtoLink('someone@industriousoffice.com')).toBe(
      'mailto:someone@industriousoffice.com',
    );
  });

  it('trims surrounding whitespace before building the link', () => {
    expect(buildMailtoLink('  someone@industriousoffice.com  ')).toBe(
      'mailto:someone@industriousoffice.com',
    );
  });

  it('returns an empty string for empty, whitespace-only, or invalid input', () => {
    expect(buildMailtoLink('')).toBe('');
    expect(buildMailtoLink('   ')).toBe('');
    expect(buildMailtoLink('notanemail')).toBe('');
    expect(buildMailtoLink('foo@')).toBe('');
    expect(buildMailtoLink('@bar')).toBe('');
    expect(buildMailtoLink('foo@bar')).toBe('');
    expect(buildMailtoLink('melissa zelko@x.com')).toBe('');
  });
});

describe('resolveSlackDmUrl', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('builds an app_redirect DM link from the resolved Slack user + team IDs', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, userId: 'U123ABC', teamId: 'T999XYZ' },
      error: null,
    });

    const url = await resolveSlackDmUrl('jane@industriousoffice.com');
    expect(url).toBe(
      `${SLACK_WORKSPACE_URL}/app_redirect?channel=U123ABC&team=T999XYZ`,
    );
    expect(mockInvoke).toHaveBeenCalledWith('slack-proxy', {
      body: { action: 'lookup_user', email: 'jane@industriousoffice.com' },
    });
  });

  it('omits the team param when the lookup returns no team ID', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, userId: 'U123ABC' },
      error: null,
    });

    const url = await resolveSlackDmUrl('jane@industriousoffice.com');
    expect(url).toBe(`${SLACK_WORKSPACE_URL}/app_redirect?channel=U123ABC`);
  });

  it('falls back to the workspace home when the lookup is unsuccessful', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: 'users_not_found' },
      error: null,
    });

    expect(await resolveSlackDmUrl('ghost@industriousoffice.com')).toBe(
      `${SLACK_WORKSPACE_URL}/`,
    );
  });

  it('falls back to the workspace home when the edge function returns an error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });

    expect(await resolveSlackDmUrl('jane@industriousoffice.com')).toBe(
      `${SLACK_WORKSPACE_URL}/`,
    );
  });

  it('falls back to the workspace home when the invoke call throws', async () => {
    mockInvoke.mockRejectedValue(new Error('network down'));

    expect(await resolveSlackDmUrl('jane@industriousoffice.com')).toBe(
      `${SLACK_WORKSPACE_URL}/`,
    );
  });

  it('trims the email before sending it to the edge function', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, userId: 'U1', teamId: 'T1' },
      error: null,
    });

    await resolveSlackDmUrl('  jane@industriousoffice.com  ');
    expect(mockInvoke).toHaveBeenCalledWith('slack-proxy', {
      body: { action: 'lookup_user', email: 'jane@industriousoffice.com' },
    });
  });

  it('returns an empty string for an invalid email without calling the edge function', async () => {
    expect(await resolveSlackDmUrl('')).toBe('');
    expect(await resolveSlackDmUrl('   ')).toBe('');
    expect(await resolveSlackDmUrl('notanemail')).toBe('');
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
