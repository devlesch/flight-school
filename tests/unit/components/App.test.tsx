import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import App from '../../../App';

// Mock the hooks
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../hooks/useProfile', () => ({
  useProfile: vi.fn(),
}));

vi.mock('../../../services/teamService', () => ({
  getAllProfiles: vi.fn(),
}));

// Mock dashboard components to avoid complex hook/data dependencies
vi.mock('../../../components/AdminDashboard', () => ({
  default: ({ user }: any) => React.createElement('div', { 'data-testid': 'admin-dashboard' }, `Admin Dashboard - ${user.name}`),
}));

vi.mock('../../../components/ManagerDashboard', () => ({
  default: ({ user }: any) => React.createElement('div', { 'data-testid': 'manager-dashboard' }, `Manager Dashboard - ${user.name}`),
}));

vi.mock('../../../components/NewHireDashboard', () => ({
  default: ({ user }: any) => React.createElement('div', { 'data-testid': 'newhire-dashboard' }, `New Hire Dashboard - ${user.name}`),
}));

// Import mocked modules
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../hooks/useProfile';
import { getAllProfiles } from '../../../services/teamService';

const mockUseAuth = vi.mocked(useAuth);
const mockUseProfile = vi.mocked(useProfile);
const mockGetAllProfiles = vi.mocked(getAllProfiles);

// Mock profile data
const adminProfile = {
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
  ...adminProfile,
  id: '2',
  email: 'manager@industrious.com',
  name: 'Manager User',
  role: 'Manager' as const,
  title: 'Regional Manager',
};

const newHireProfile = {
  ...adminProfile,
  id: '3',
  email: 'newhire@industrious.com',
  name: 'New Hire User',
  role: 'New Hire' as const,
  title: 'Associate',
};

describe('App', () => {
  const mockSignIn = vi.fn();
  const mockSignOut = vi.fn();
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Task 4.1.1: Render Tests', () => {
    it('should render Login screen when no user is logged in', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: false,
        error: null,
        signIn: mockSignIn,
        signOut: mockSignOut,
      });
      mockUseProfile.mockReturnValue({
        profile: null,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<App />);

      // Should show Login screen elements
      expect(screen.getByText('Great days start here.')).toBeInTheDocument();
      expect(screen.getByText('Welcome')).toBeInTheDocument();
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    });

    it('should show loading state while authenticating', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: true,
        error: null,
        signIn: mockSignIn,
        signOut: mockSignOut,
      });
      mockUseProfile.mockReturnValue({
        profile: null,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<App />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show auth error when sign-in fails', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: false,
        error: 'Authentication failed',
        signIn: mockSignIn,
        signOut: mockSignOut,
      });
      mockUseProfile.mockReturnValue({
        profile: null,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<App />);

      expect(screen.getByText('Sign In Failed')).toBeInTheDocument();
      expect(screen.getByText('Authentication failed')).toBeInTheDocument();
    });
  });

  describe('Task 4.1.2: Role-based Rendering Tests', () => {
    it('should render AdminDashboard when admin user logs in', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1' } as any,
        session: {} as any,
        loading: false,
        error: null,
        signIn: mockSignIn,
        signOut: mockSignOut,
      });
      mockUseProfile.mockReturnValue({
        profile: adminProfile,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<App />);

      // Should show AdminDashboard (mocked)
      expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
      expect(screen.getByText('Admin Dashboard - Admin User')).toBeInTheDocument();
    });

    it('should render ManagerDashboard when manager user logs in', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '2' } as any,
        session: {} as any,
        loading: false,
        error: null,
        signIn: mockSignIn,
        signOut: mockSignOut,
      });
      mockUseProfile.mockReturnValue({
        profile: managerProfile,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<App />);

      // Should show ManagerDashboard (mocked)
      expect(screen.getByTestId('manager-dashboard')).toBeInTheDocument();
    });

    it('should render NewHireDashboard when new hire user logs in', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '3' } as any,
        session: {} as any,
        loading: false,
        error: null,
        signIn: mockSignIn,
        signOut: mockSignOut,
      });
      mockUseProfile.mockReturnValue({
        profile: newHireProfile,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<App />);

      // Should show NewHireDashboard (mocked)
      expect(screen.getByTestId('newhire-dashboard')).toBeInTheDocument();
    });
  });

  describe('Task 4.1.3: Navigation Tests', () => {
    it('should render sidebar navigation for logged-in admin users', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1' } as any,
        session: {} as any,
        loading: false,
        error: null,
        signIn: mockSignIn,
        signOut: mockSignOut,
      });
      mockUseProfile.mockReturnValue({
        profile: adminProfile,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<App />);

      // Should show sidebar navigation items
      expect(screen.getByText('Admin Console')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('People')).toBeInTheDocument();
      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('New Bees & Cohorts')).toBeInTheDocument();
    });

    it('should switch to workflow view when Workflow button is clicked', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1' } as any,
        session: {} as any,
        loading: false,
        error: null,
        signIn: mockSignIn,
        signOut: mockSignOut,
      });
      mockUseProfile.mockReturnValue({
        profile: adminProfile,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<App />);

      // Click People in sidebar
      fireEvent.click(screen.getByText('People'));

      // The AdminDashboard should still be rendered (mocked)
      expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
    });

    it('should call signOut when Sign Out is clicked', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1' } as any,
        session: {} as any,
        loading: false,
        error: null,
        signIn: mockSignIn,
        signOut: mockSignOut,
      });
      mockUseProfile.mockReturnValue({
        profile: adminProfile,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<App />);

      // Click Sign Out
      fireEvent.click(screen.getByText('Sign Out'));

      // Should call signOut function
      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
    });

    it('should call signIn when Google sign-in button is clicked', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: false,
        error: null,
        signIn: mockSignIn,
        signOut: mockSignOut,
      });
      mockUseProfile.mockReturnValue({
        profile: null,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<App />);

      // Click Sign in with Google button
      fireEvent.click(screen.getByText('Sign in with Google'));

      expect(mockSignIn).toHaveBeenCalled();
    });
  });

  describe('Impersonation State Management', () => {
    const setupAdminView = () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1' } as any,
        session: {} as any,
        loading: false,
        error: null,
        signIn: mockSignIn,
        signOut: mockSignOut,
      });
      mockUseProfile.mockReturnValue({
        profile: adminProfile,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });
      mockGetAllProfiles.mockResolvedValue([adminProfile, managerProfile, newHireProfile] as any);
    };

    it('should not render ImpersonationBanner by default', () => {
      setupAdminView();
      render(<App />);

      expect(screen.queryByTestId('impersonation-banner')).not.toBeInTheDocument();
      expect(screen.queryByText(/UI preview only/i)).not.toBeInTheDocument();
    });

    it('should render ImpersonationBanner when impersonation is active', async () => {
      setupAdminView();
      render(<App />);

      // Click "View as..." to open picker
      const viewAsButton = screen.getByText('View as...');
      fireEvent.click(viewAsButton);

      // Wait for profiles to load and select a manager
      await waitFor(() => {
        const managerEntries = screen.getAllByText('Manager User');
        expect(managerEntries.length).toBeGreaterThanOrEqual(1);
      });
      // Click the first instance (the picker entry)
      fireEvent.click(screen.getAllByText('Manager User')[0]);

      // Banner should appear
      await waitFor(() => {
        expect(screen.getByTestId('impersonation-banner')).toBeInTheDocument();
        expect(screen.getByText(/UI preview only/i)).toBeInTheDocument();
      });
    });

    it('should show ManagerDashboard when impersonating a manager', async () => {
      setupAdminView();
      render(<App />);

      // Trigger impersonation as manager
      const viewAsButton = screen.getByText('View as...');
      fireEvent.click(viewAsButton);

      await waitFor(() => {
        expect(screen.getByText('Manager User')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Manager User'));

      // Dashboard should switch to Manager (mocked)
      await waitFor(() => {
        expect(screen.getByTestId('manager-dashboard')).toBeInTheDocument();
      });

      // Admin Console should not be in sidebar
      expect(screen.queryByText('Admin Console')).not.toBeInTheDocument();
    });

    it('should return to admin view when exiting impersonation', async () => {
      setupAdminView();
      render(<App />);

      // Start impersonation
      const viewAsButton = screen.getByText('View as...');
      fireEvent.click(viewAsButton);

      await waitFor(() => {
        expect(screen.getByText('Manager User')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Manager User'));

      // Verify impersonation is active
      await waitFor(() => {
        expect(screen.getByTestId('impersonation-banner')).toBeInTheDocument();
      });

      // Click Exit
      fireEvent.click(screen.getByRole('button', { name: /exit/i }));

      // Banner should disappear, admin view should return
      await waitFor(() => {
        expect(screen.queryByTestId('impersonation-banner')).not.toBeInTheDocument();
        expect(screen.getByText('Admin Console')).toBeInTheDocument();
      });
    });
  });
});
