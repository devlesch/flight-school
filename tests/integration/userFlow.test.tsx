import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../App';

// Mock the hooks
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../hooks/useProfile', () => ({
  useProfile: vi.fn(),
}));

// Import mocked modules
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';

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

describe('User Flow Integration Tests', () => {
  const mockSignIn = vi.fn();
  const mockSignOut = vi.fn();
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Task 5.1.1: Role-based Dashboard Tests', () => {
    it('should show Login screen when not authenticated', () => {
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

      // Verify Login screen is shown
      expect(screen.getByText('Great days start here.')).toBeInTheDocument();
      expect(screen.getByText('Welcome')).toBeInTheDocument();
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    });

    it('should show AdminDashboard for Admin user with correct elements', () => {
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

      // Verify AdminDashboard is shown
      expect(screen.getByText('Operations Admin Portal')).toBeInTheDocument();
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();

      // Verify sidebar navigation is present
      expect(screen.getByText('Admin Console')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Workflow & Tasks')).toBeInTheDocument();
    });

    it('should show ManagerDashboard for Manager user with welcome guide', () => {
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

      // Verify ManagerDashboard welcome guide is shown
      expect(screen.getByText(/Welcome,/)).toBeInTheDocument();
      expect(screen.getByText('Track Progress')).toBeInTheDocument();
      expect(screen.getByText('Get Started!')).toBeInTheDocument();

      // Dismiss welcome and verify main dashboard
      fireEvent.click(screen.getByText('Get Started!'));
      const myTeamElements = screen.getAllByText('My Team');
      expect(myTeamElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should show NewHireDashboard for New Hire user with welcome guide', () => {
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

      // Verify NewHireDashboard welcome guide is shown
      expect(screen.getByText('Congratulations!')).toBeInTheDocument();
      expect(screen.getByText(/We are SO glad you are here!/)).toBeInTheDocument();
      expect(screen.getByText('Get Started!')).toBeInTheDocument();

      // Dismiss welcome and verify main dashboard
      fireEvent.click(screen.getByText('Get Started!'));
      const myJourneyElements = screen.getAllByText('My Journey');
      expect(myJourneyElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Task 5.1.2: View Mode Switching Integration Tests', () => {
    it('should allow Admin to navigate between all view modes', () => {
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

      // Verify initial dashboard view
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();

      // Switch to Workflow view
      fireEvent.click(screen.getByText('Workflow & Tasks'));
      expect(screen.getByText('Import team members, manage active registry, and automate training.')).toBeInTheDocument();

      // Switch to Cohorts view
      fireEvent.click(screen.getByText('New Bees & Cohorts'));
      expect(screen.getByText('All Regions')).toBeInTheDocument();

      // Switch back to Dashboard view
      fireEvent.click(screen.getByText('Dashboard'));
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
    });

    it('should allow Admin to preview Manager view via sidebar', () => {
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

      // Find and click Manager Overview in sidebar
      const managerOverviewElements = screen.getAllByText('Manager Overview');
      // Click the sidebar button (not the header)
      fireEvent.click(managerOverviewElements[0]);

      // Should show Manager dashboard content (welcome guide initially)
      expect(screen.getByText('Track Progress')).toBeInTheDocument();
    });

    it('should allow Admin to preview New Hire view via sidebar', () => {
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

      // Click New Hire View in sidebar (shows as "New Hire View" for admins)
      fireEvent.click(screen.getByText('New Hire View'));

      // Should show New Hire dashboard content (welcome guide initially)
      expect(screen.getByText('Congratulations!')).toBeInTheDocument();
    });

    it('should call signOut when Sign Out is clicked and user is logged out', async () => {
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

      // Switch between multiple views
      fireEvent.click(screen.getByText('Workflow & Tasks'));
      fireEvent.click(screen.getByText('New Bees & Cohorts'));
      fireEvent.click(screen.getByText('Dashboard'));

      // User should still be logged in (Sign Out button visible)
      expect(screen.getByText('Sign Out')).toBeInTheDocument();

      // Logout
      fireEvent.click(screen.getByText('Sign Out'));

      // Verify signOut was called
      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
    });
  });
});
