import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { Profile } from '../../../types/database';

const mockUseSupportContact = vi.fn();

vi.mock('../../../hooks/useSupportContact', () => ({
  useSupportContact: (...args: unknown[]) => mockUseSupportContact(...args),
}));

// Real buildSlackDeepLink is fine (pure function); no mock for slackService.

const SupportFabModule = await import('../../../components/SupportFab');
const SupportFab = SupportFabModule.default;

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p-1',
    email: 'p1@industriousoffice.com',
    name: 'Test User',
    role: 'New Hire',
    avatar: null,
    title: 'MXM',
    region: 'East',
    location: null,
    standardized_role: 'Member Experience Manager',
    manager_id: null,
    department: 'Experience',
    start_date: null,
    provisioned: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const newHire = makeProfile({ id: 'nh-1', manager_id: 'mgr-1' });
const newHireNoMgr = makeProfile({ id: 'nh-2', manager_id: null });

const managerProfile = makeProfile({
  id: 'mgr-1',
  name: 'Jane Manager',
  email: 'jane.manager@industriousoffice.com',
  role: 'Manager',
  title: 'Regional Director',
  avatar: null,
  manager_id: null,
});

const fallbackProfile = makeProfile({
  id: 'mz-1',
  name: 'Melissa Zelko',
  email: 'melissa.zelko@industriousoffice.com',
  role: 'Admin',
  title: 'People Ops',
  manager_id: null,
});

describe('SupportFab', () => {
  beforeEach(() => {
    mockUseSupportContact.mockReset();
  });

  it('(a) renders manager card with name, title, email, and Slack link href', () => {
    mockUseSupportContact.mockReturnValue({
      contact: managerProfile,
      source: 'manager',
      loading: false,
      error: null,
    });

    render(<SupportFab currentProfile={newHire} />);
    const fab = screen.getByRole('button', { name: /open support/i });
    fireEvent.click(fab);

    expect(screen.getByText('Jane Manager')).toBeInTheDocument();
    expect(screen.getByText('Regional Director')).toBeInTheDocument();
    expect(screen.getByText('jane.manager@industriousoffice.com')).toBeInTheDocument();

    const slackLink = screen.getByRole('link', { name: /open in slack/i });
    expect(slackLink).toHaveAttribute(
      'href',
      'https://industriousoffice.slack.com/app_redirect?email=' +
        encodeURIComponent('jane.manager@industriousoffice.com'),
    );
    expect(slackLink).toHaveAttribute('target', '_blank');
    expect(slackLink).toHaveAttribute('rel', 'noreferrer');
  });

  it('(b) renders fallback card with "Your fallback support contact" label', () => {
    mockUseSupportContact.mockReturnValue({
      contact: fallbackProfile,
      source: 'fallback',
      loading: false,
      error: null,
    });

    render(<SupportFab currentProfile={newHireNoMgr} />);
    fireEvent.click(screen.getByRole('button', { name: /open support/i }));

    expect(screen.getByText(/your fallback support contact/i)).toBeInTheDocument();
    expect(screen.getByText('Melissa Zelko')).toBeInTheDocument();
  });

  it('(c) renders "No support contact configured" empty state with NO Slack link', () => {
    mockUseSupportContact.mockReturnValue({
      contact: null,
      source: 'none',
      loading: false,
      error: null,
    });

    render(<SupportFab currentProfile={newHireNoMgr} />);
    fireEvent.click(screen.getByRole('button', { name: /open support/i }));

    expect(
      screen.getByText(/no support contact configured/i),
    ).toBeInTheDocument();

    // No app_redirect link should exist.
    const allLinks = screen.queryAllByRole('link');
    for (const link of allLinks) {
      expect(link.getAttribute('href') ?? '').not.toContain('app_redirect');
    }
  });

  it('(d) Slack link href exactly matches https://industriousoffice.slack.com/app_redirect?email=<encoded>', () => {
    const m = { ...managerProfile, email: 'first+tag@industriousoffice.com' };
    mockUseSupportContact.mockReturnValue({
      contact: m,
      source: 'manager',
      loading: false,
      error: null,
    });

    render(<SupportFab currentProfile={newHire} />);
    fireEvent.click(screen.getByRole('button', { name: /open support/i }));

    const slackLink = screen.getByRole('link', { name: /open in slack/i });
    const expected =
      'https://industriousoffice.slack.com/app_redirect?email=' +
      encodeURIComponent('first+tag@industriousoffice.com');
    expect(slackLink.getAttribute('href')).toBe(expected);
    // Sanity: encoded `+` to `%2B`.
    expect(slackLink.getAttribute('href')).toContain('%2B');
  });

  it('(e) popover opens on FAB click, closes on Escape, and closes on outside click', () => {
    mockUseSupportContact.mockReturnValue({
      contact: managerProfile,
      source: 'manager',
      loading: false,
      error: null,
    });

    render(<SupportFab currentProfile={newHire} />);
    const fab = screen.getByRole('button', { name: /open support/i });

    // Open.
    fireEvent.click(fab);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Escape closes.
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Reopen, then click outside.
    fireEvent.click(fab);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('(f) FAB has aria-label, popover has role="dialog", and focus is inside dialog after open', async () => {
    mockUseSupportContact.mockReturnValue({
      contact: managerProfile,
      source: 'manager',
      loading: false,
      error: null,
    });

    render(<SupportFab currentProfile={newHire} />);
    const fab = screen.getByRole('button', { name: /open support/i });
    expect(fab).toHaveAttribute('aria-label', 'Open support');

    fireEvent.click(fab);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Focus should land inside dialog (after the setTimeout(0) tick).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
