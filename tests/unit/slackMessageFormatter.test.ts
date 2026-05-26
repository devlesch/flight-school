import { describe, it, expect } from 'vitest';
import { formatSlackMessage } from '../../services/slackMessageFormatter';

const BANNER = ':airplane: ✦ *FLIGHT SCHOOL* ✦ :airplane:';

describe('formatSlackMessage — shape', () => {
  it('starts with the Flight School banner', () => {
    const out = formatSlackMessage({ title: 'Welcome aboard', body: 'Hi Sam', kind: 'slack' });
    expect(out.startsWith(BANNER)).toBe(true);
  });

  it('includes the Flight School attribution', () => {
    const out = formatSlackMessage({ title: 'T', body: 'B', kind: 'slack' });
    expect(out).toContain('FLIGHT SCHOOL');
  });

  it('renders a visual divider line between header and body', () => {
    const out = formatSlackMessage({ title: 'T', body: 'B', kind: 'slack' });
    expect(out).toContain('━');
  });

  it('renders a kind emoji + bold title line', () => {
    const out = formatSlackMessage({ title: 'Welcome aboard', body: 'Hi Sam', kind: 'slack' });
    expect(out).toContain(':rocket: *Welcome aboard*');
  });

  it('preserves the body verbatim at the tail (no `from`)', () => {
    const body = 'Multi-line body\nwith a second line.';
    const out = formatSlackMessage({ title: 'T', body, kind: 'slack' });
    expect(out.endsWith(body)).toBe(true);
  });

  it('appends a sender attribution footer when `from` is provided', () => {
    const out = formatSlackMessage({ title: 'T', body: 'Hi Sam', kind: 'slack', from: 'Bob Smith' });
    expect(out.endsWith('\n\n_— Bob Smith_')).toBe(true);
    // Body stays intact, footer is its own paragraph.
    expect(out).toContain('Hi Sam\n\n_— Bob Smith_');
  });

  it('omits the footer when `from` is missing or empty', () => {
    const noFrom = formatSlackMessage({ title: 'T', body: 'B', kind: 'slack' });
    expect(noFrom).not.toContain('_— ');
    const emptyFrom = formatSlackMessage({ title: 'T', body: 'B', kind: 'slack', from: '' });
    expect(emptyFrom).not.toContain('_— ');
  });

  it('produces the full canonical layout', () => {
    const out = formatSlackMessage({ title: 'Welcome aboard', body: 'Hi Sam', kind: 'slack' });
    expect(out).toBe(
      ':airplane: ✦ *FLIGHT SCHOOL* ✦ :airplane:\n' +
        '━━━━━━━━━━━━━━━━━━━\n' +
        ':rocket: *Welcome aboard*\n\n' +
        'Hi Sam'
    );
  });
});

describe('formatSlackMessage — kind → emoji mapping', () => {
  it('falls back to default emoji when kind is missing', () => {
    const out = formatSlackMessage({ title: 'X', body: 'Y' });
    expect(out).toContain(':rocket: *X*');
  });

  it('falls back to default emoji when kind is unknown', () => {
    const out = formatSlackMessage({ title: 'X', body: 'Y', kind: 'no-such-kind' });
    expect(out).toContain(':rocket: *X*');
  });

  it('maps "email" kind to envelope emoji', () => {
    const out = formatSlackMessage({ title: 'X', body: 'Y', kind: 'email' });
    expect(out).toContain(':envelope: *X*');
  });

  it('maps "survey" kind to clipboard emoji', () => {
    const out = formatSlackMessage({ title: 'X', body: 'Y', kind: 'survey' });
    expect(out).toContain(':clipboard: *X*');
  });

  it('is case-insensitive for kind', () => {
    const out = formatSlackMessage({ title: 'X', body: 'Y', kind: 'EMAIL' });
    expect(out).toContain(':envelope: *X*');
  });
});

describe('formatSlackMessage — idempotency', () => {
  it('format(format(x)) === format(x) — does not double-wrap', () => {
    const once = formatSlackMessage({ title: 'T', body: 'B', kind: 'slack' });
    const twice = formatSlackMessage({ title: 'T', body: once, kind: 'slack' });
    expect(twice).toBe(once);
  });

  it('detects pre-decorated input even with different title/kind', () => {
    const once = formatSlackMessage({ title: 'Original', body: 'Body', kind: 'email' });
    const twice = formatSlackMessage({ title: 'Different', body: once, kind: 'slack' });
    expect(twice).toBe(once);
  });
});
