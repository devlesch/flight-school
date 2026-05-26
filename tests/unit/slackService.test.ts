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

    // profiles.select(...).ilike(...).maybeSingle() → recipient lookup
    // (case-insensitive so mixed-case stored emails match — Task 2)
    // slack_messages.insert(...) → log write
    supabaseAny.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            ilike: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
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
    expect(sentText).toContain('FLIGHT SCHOOL');
    expect(sentText).toContain('━');
    expect(sentText).toMatch(/^:airplane:/);
    expect(sentText.endsWith('Hi Sam')).toBe(true);
  });

  it('logs the RAW body (not the decorated text) to slack_messages', async () => {
    await sendSlackDM('sam@example.com', 'Hi Sam', { title: 'Welcome aboard', kind: 'slack' });
    expect(insertMock).toHaveBeenCalledTimes(1);
    const inserted = insertMock.mock.calls[0][0];
    expect(inserted.message_text).toBe('Hi Sam');
    expect(inserted.message_text).not.toContain('FLIGHT SCHOOL');
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

  it('matches mixed-case stored emails via case-insensitive ilike lookup (Task 2)', async () => {
    // Stored email is "Liam.Kinna@…"; the user passes the same case (or any case).
    // The recipient lookup uses `.ilike('email', email)` so Postgres matches
    // regardless of stored case. Previously the client lowered the search term
    // and `.eq` missed mixed-case storage → silent INSERT skip.
    const ilikeSpy = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'liam-id' }, error: null }),
    });
    supabaseAny.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ ilike: ilikeSpy }) };
      }
      if (table === 'slack_messages') {
        return { insert: insertMock };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await sendSlackDM('Liam.Kinna@industriousoffice.com', 'Hi Liam', { title: 'T' });

    // Lookup MUST be ilike on raw email (not lowercased), so mixed-case stored
    // values match the search term regardless of caller-supplied case.
    expect(ilikeSpy).toHaveBeenCalledWith('email', 'Liam.Kinna@industriousoffice.com');

    // And the INSERT must fire with the resolved recipient_id (i.e. the
    // case-mismatch silent-skip is gone).
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0].recipient_id).toBe('liam-id');
  });
});
