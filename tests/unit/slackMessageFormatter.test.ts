import { describe, it, expect } from 'vitest';
import { formatSlackMessage } from '../../services/slackMessageFormatter';

describe('formatSlackMessage — shape', () => {
  it('starts with an emoji + bold title', () => {
    const out = formatSlackMessage({ title: 'Welcome aboard', body: 'Hi Sam', kind: 'slack' });
    expect(out).toMatch(/^:rocket: \*Welcome aboard\*/);
  });

  it('includes the Flight School attribution', () => {
    const out = formatSlackMessage({ title: 'T', body: 'B', kind: 'slack' });
    expect(out).toContain('Flight School');
  });

  it('renders a visual divider line between header and body', () => {
    const out = formatSlackMessage({ title: 'T', body: 'B', kind: 'slack' });
    expect(out).toContain('———');
  });

  it('preserves the body verbatim at the tail', () => {
    const body = 'Multi-line body\nwith a second line.';
    const out = formatSlackMessage({ title: 'T', body, kind: 'slack' });
    expect(out.endsWith(body)).toBe(true);
  });

  it('produces the full canonical layout', () => {
    const out = formatSlackMessage({ title: 'Welcome aboard', body: 'Hi Sam', kind: 'slack' });
    expect(out).toBe(':rocket: *Welcome aboard*\n_Flight School_\n———\nHi Sam');
  });
});

describe('formatSlackMessage — kind → emoji mapping', () => {
  it('falls back to default emoji when kind is missing', () => {
    const out = formatSlackMessage({ title: 'X', body: 'Y' });
    expect(out.startsWith(':rocket:')).toBe(true);
  });

  it('falls back to default emoji when kind is unknown', () => {
    const out = formatSlackMessage({ title: 'X', body: 'Y', kind: 'no-such-kind' });
    expect(out.startsWith(':rocket:')).toBe(true);
  });

  it('maps "email" kind to envelope emoji', () => {
    const out = formatSlackMessage({ title: 'X', body: 'Y', kind: 'email' });
    expect(out.startsWith(':envelope:')).toBe(true);
  });

  it('maps "survey" kind to clipboard emoji', () => {
    const out = formatSlackMessage({ title: 'X', body: 'Y', kind: 'survey' });
    expect(out.startsWith(':clipboard:')).toBe(true);
  });

  it('is case-insensitive for kind', () => {
    const out = formatSlackMessage({ title: 'X', body: 'Y', kind: 'EMAIL' });
    expect(out.startsWith(':envelope:')).toBe(true);
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
