import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../../App';

// Mock the hooks
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../hooks/useProfile', () => ({
  useProfile: vi.fn(),
}));

// Import mocked modules
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../hooks/useProfile';

const mockUseAuth = vi.mocked(useAuth);
const mockUseProfile = vi.mocked(useProfile);

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

      // Should show AdminDashboard
      expect(screen.getByText('Operations Admin Portal')).toBeInTheDocument();
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
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

      // Should show ManagerDashboard header (appears in sidebar button and h1)
      const managerOverviewElements = screen.getAllByText('Manager Overview');
      expect(managerOverviewElements.length).toBeGreaterThanOrEqual(1);
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

      // Should show NewHireDashboard header
      expect(screen.getByText('Onboarding Journey')).toBeInTheDocument();
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

      // The AdminDashboard should now show Workflow view subtitle
      expect(screen.getByText('Import team members, manage active registry, and automate training.')).toBeInTheDocument();
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
});
