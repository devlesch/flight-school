import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from '../../App';

// Mock auth/profile hooks so we can flip role per-test.
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../../hooks/useProfile', () => ({
  useProfile: vi.fn(),
}));

// Mock the dashboards so we don't pull in their full data graphs.
vi.mock('../../components/AdminDashboard', () => ({
  default: ({ user }: any) =>
    React.createElement('div', { 'data-testid': 'admin-dashboard' }, `Admin - ${user.name}`),
}));
vi.mock('../../components/ManagerDashboard', () => ({
  default: ({ user }: any) =>
    React.createElement('div', { 'data-testid': 'manager-dashboard' }, `Manager - ${user.name}`),
}));
vi.mock('../../components/NewHireDashboard', () => ({
  default: ({ user }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'newhire-dashboard' },
      `New Hire - ${user.name}`
    ),
}));

// Mock useSupportContact so the FAB renders without hitting Supabase.
vi.mock('../../hooks/useSupportContact', () => ({
  useSupportContact: () => ({
    contact: null,
    source: 'none',
    loading: false,
    error: null,
  }),
}));

import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';

const mockUseAuth = vi.mocked(useAuth);
const mockUseProfile = vi.mocked(useProfile);

const baseProfile = {
  id: '1',
  email: 'admin@industrious.com',
  name: 'Admin User',
  role: 'Admin' as const,
  avatar: 'https://example.com/avatar.jpg',
  title: 'Administrator',
  region: 'Northeast',
  manager_id: null,
  department: 'Operations',
  start_date: '2024-01-01',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const managerProfile = {
  ...baseProfile,
  id: '2',
  email: 'manager@industrious.com',
  name: 'Manager User',
  role: 'Manager' as const,
  title: 'Regional Manager',
};

const newHireProfile = {
  ...baseProfile,
  id: '3',
  email: 'newhire@industrious.com',
  name: 'New Hire User',
  role: 'New Hire' as const,
  title: 'Associate',
};

const signedIn = (user: { id: string }) => {
  mockUseAuth.mockReturnValue({
    user: user as any,
    session: {} as any,
    loading: false,
    error: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });
};

describe('SupportFab across routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the SupportFab on the Admin dashboard', () => {
    signedIn({ id: '1' });
    mockUseProfile.mockReturnValue({
      profile: baseProfile,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<App />);

    expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /open support/i })
    ).toBeInTheDocument();
  });

  it('renders the SupportFab on the Manager dashboard', () => {
    signedIn({ id: '2' });
    mockUseProfile.mockReturnValue({
      profile: managerProfile,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<App />);

    expect(screen.getByTestId('manager-dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText('Open support')).toBeInTheDocument();
  });

  it('renders the SupportFab on the New Hire dashboard', () => {
    signedIn({ id: '3' });
    mockUseProfile.mockReturnValue({
      profile: newHireProfile,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<App />);

    expect(screen.getByTestId('newhire-dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText('Open support')).toBeInTheDocument();
  });

  it('does NOT render the SupportFab on the Login screen', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      error: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    mockUseProfile.mockReturnValue({
      profile: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<App />);

    // Login screen marker
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    // FAB must be absent
    expect(screen.queryByLabelText('Open support')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /open support/i })
    ).toBeNull();
  });
});
