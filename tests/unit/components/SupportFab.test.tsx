import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { Profile } from '../../../types/database';

const mockUseSupportContact = vi.fn();
const mockResolveSlackDmUrl = vi.fn();

vi.mock('../../../hooks/useSupportContact', () => ({
  useSupportContact: (...args: unknown[]) => mockUseSupportContact(...args),
}));

// `resolveSlackDmUrl` hits the slack-proxy edge function — mock it. The
// `buildMailtoLink` stub mirrors the real (pure) validation behaviour.
vi.mock('../../../services/slackService', () => ({
  resolveSlackDmUrl: (...args: unknown[]) => mockResolveSlackDmUrl(...args),
  buildMailtoLink: (email: string) =>
    typeof email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? `mailto:${email.trim()}`
      : '',
  SLACK_WORKSPACE_URL: 'https://industriousoffice.slack.com',
}));

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
    mockResolveSlackDmUrl.mockReset();
    mockResolveSlackDmUrl.mockResolvedValue(
      'https://industriousoffice.slack.com/app_redirect?channel=U_JANE&team=T1',
    );
  });

  it('(a) renders manager card with name, title, email, and Slack DM link', async () => {
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
    // Starts at the workspace home, then upgrades to the resolved DM link.
    await waitFor(() =>
      expect(slackLink).toHaveAttribute(
        'href',
        'https://industriousoffice.slack.com/app_redirect?channel=U_JANE&team=T1',
      ),
    );
    expect(slackLink).toHaveAttribute('target', '_blank');
    expect(slackLink).toHaveAttribute('rel', 'noreferrer');
    expect(mockResolveSlackDmUrl).toHaveBeenCalledWith(
      'jane.manager@industriousoffice.com',
    );
  });

  it('(b) renders fallback card with "Your fallback support contact" label', async () => {
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

    // Let the async Slack-link resolution settle so it doesn't leak past the test.
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: /open in slack/i }),
      ).toHaveAttribute(
        'href',
        'https://industriousoffice.slack.com/app_redirect?channel=U_JANE&team=T1',
      ),
    );
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

  it('(d) Slack link href is the DM deep link resolved by resolveSlackDmUrl', async () => {
    mockResolveSlackDmUrl.mockResolvedValue(
      'https://industriousoffice.slack.com/app_redirect?channel=U_PLUS&team=T1',
    );
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
    await waitFor(() =>
      expect(slackLink.getAttribute('href')).toBe(
        'https://industriousoffice.slack.com/app_redirect?channel=U_PLUS&team=T1',
      ),
    );
    expect(mockResolveSlackDmUrl).toHaveBeenCalledWith(
      'first+tag@industriousoffice.com',
    );
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
