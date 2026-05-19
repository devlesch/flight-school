import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendSlackDM } from '../../services/slackService';
import { supabase } from '../../lib/supabase';

const supabaseAny = supabase as unknown as {
  functions: { invoke: ReturnType<typeof vi.fn> };
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
};

describe('sendSlackDM', () => {
  let invokeMock: ReturnType<typeof vi.fn>;
  let insertMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    invokeMock = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    insertMock = vi.fn().mockResolvedValue({ error: null });

    // Inject functions.invoke
    supabaseAny.functions = { invoke: invokeMock };

    // Authenticated user
    supabaseAny.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'sender-id' } },
      error: null,
    });

    // profiles.select(...).eq(...).single() → recipient lookup
    // slack_messages.insert(...) → log write
    supabaseAny.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'recipient-id' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'slack_messages') {
        return { insert: insertMock };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('sends the RAW body when no opts are provided', async () => {
    const result = await sendSlackDM('sam@example.com', 'Hello world');
    expect(result.success).toBe(true);
    const sentText = invokeMock.mock.calls[0][1].body.text;
    expect(sentText).toBe('Hello world');
  });

  it('sends DECORATED text when opts.title is provided', async () => {
    await sendSlackDM('sam@example.com', 'Hi Sam', { title: 'Welcome aboard', kind: 'slack' });
    const sentText = invokeMock.mock.calls[0][1].body.text;
    expect(sentText).toContain('Welcome aboard');
    expect(sentText).toContain('Flight School');
    expect(sentText).toContain('———');
    expect(sentText).toMatch(/^:rocket:/);
    expect(sentText.endsWith('Hi Sam')).toBe(true);
  });

  it('logs the RAW body (not the decorated text) to slack_messages', async () => {
    await sendSlackDM('sam@example.com', 'Hi Sam', { title: 'Welcome aboard', kind: 'slack' });
    expect(insertMock).toHaveBeenCalledTimes(1);
    const inserted = insertMock.mock.calls[0][0];
    expect(inserted.message_text).toBe('Hi Sam');
    expect(inserted.message_text).not.toContain('Flight School');
  });

  it('returns logged=true on successful send + insert', async () => {
    const result = await sendSlackDM('sam@example.com', 'Hi Sam', { title: 'T' });
    expect(result).toEqual({ success: true, logged: true });
  });

  it('surfaces edge-function errors without logging', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'mcp down' } });
    const result = await sendSlackDM('sam@example.com', 'Hi Sam', { title: 'T' });
    expect(result).toEqual({ success: false, error: 'mcp down' });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('surfaces tool-level failures without logging', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { success: false, error: 'user not in slack' },
      error: null,
    });
    const result = await sendSlackDM('sam@example.com', 'Hi Sam', { title: 'T' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('user not in slack');
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('lowercases the recipient email when looking up profile', async () => {
    const eqSpy = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'recipient-id' }, error: null }),
    });
    supabaseAny.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ eq: eqSpy }) };
      }
      if (table === 'slack_messages') {
        return { insert: insertMock };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await sendSlackDM('SAM@Example.COM', 'Hi Sam', { title: 'T' });
    expect(eqSpy).toHaveBeenCalledWith('email', 'sam@example.com');
  });
});
