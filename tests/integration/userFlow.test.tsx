import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../../App';

describe('User Flow Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Task 5.1.1: Role Switching Integration Tests', () => {
    it('should complete full flow: render App → login as Admin → verify AdminDashboard', async () => {
      render(<App />);

      // Step 1: Verify Login screen is shown
      expect(screen.getByText('Great days start here.')).toBeInTheDocument();
      expect(screen.getByText('Welcome Back')).toBeInTheDocument();

      // Step 2: Enter admin credentials
      const input = screen.getByPlaceholderText('name@industriousoffice.com');
      fireEvent.change(input, { target: { value: 'admin' } });
      expect(input).toHaveValue('admin');

      // Step 3: Submit login
      fireEvent.click(screen.getByText('Sign In'));

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Step 4: Verify AdminDashboard is shown
      expect(screen.getByText('Operations Admin Portal')).toBeInTheDocument();
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();

      // Step 5: Verify sidebar navigation is present
      expect(screen.getByText('Admin Console')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Workflow & Tasks')).toBeInTheDocument();
    });

    it('should complete full flow: render App → login as Manager → verify ManagerDashboard', async () => {
      render(<App />);

      // Step 1: Verify Login screen
      expect(screen.getByText('Welcome Back')).toBeInTheDocument();

      // Step 2: Enter manager credentials
      const input = screen.getByPlaceholderText('name@industriousoffice.com');
      fireEvent.change(input, { target: { value: 'manager' } });

      // Step 3: Submit login
      fireEvent.click(screen.getByText('Sign In'));

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Step 4: Verify ManagerDashboard welcome guide is shown
      expect(screen.getByText(/Welcome,/)).toBeInTheDocument();
      expect(screen.getByText('Track Progress')).toBeInTheDocument();
      expect(screen.getByText('Get Started!')).toBeInTheDocument();

      // Step 5: Dismiss welcome and verify main dashboard
      fireEvent.click(screen.getByText('Get Started!'));
      const myTeamElements = screen.getAllByText('My Team');
      expect(myTeamElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should complete full flow: render App → login as New Hire → verify NewHireDashboard', async () => {
      render(<App />);

      // Step 1: Verify Login screen
      expect(screen.getByText('Welcome Back')).toBeInTheDocument();

      // Step 2: Enter new hire credentials
      const input = screen.getByPlaceholderText('name@industriousoffice.com');
      fireEvent.change(input, { target: { value: 'new' } });

      // Step 3: Submit login
      fireEvent.click(screen.getByText('Sign In'));

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Step 4: Verify NewHireDashboard welcome guide is shown
      expect(screen.getByText('Congratulations!')).toBeInTheDocument();
      expect(screen.getByText(/We are SO glad you are here!/)).toBeInTheDocument();
      expect(screen.getByText('Get Started!')).toBeInTheDocument();

      // Step 5: Dismiss welcome and verify main dashboard
      fireEvent.click(screen.getByText('Get Started!'));
      const myJourneyElements = screen.getAllByText('My Journey');
      expect(myJourneyElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Task 5.1.2: View Mode Switching Integration Tests', () => {
    it('should allow Admin to navigate between all view modes', async () => {
      render(<App />);

      // Login as admin
      const input = screen.getByPlaceholderText('name@industriousoffice.com');
      fireEvent.change(input, { target: { value: 'admin' } });
      fireEvent.click(screen.getByText('Sign In'));

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

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

    it('should allow Admin to preview Manager view via sidebar', async () => {
      render(<App />);

      // Login as admin
      const input = screen.getByPlaceholderText('name@industriousoffice.com');
      fireEvent.change(input, { target: { value: 'admin' } });
      fireEvent.click(screen.getByText('Sign In'));

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Find and click Manager Overview in sidebar
      const managerOverviewElements = screen.getAllByText('Manager Overview');
      // Click the sidebar button (not the header)
      fireEvent.click(managerOverviewElements[0]);

      // Should show Manager dashboard content (welcome guide initially)
      expect(screen.getByText('Track Progress')).toBeInTheDocument();
    });

    it('should allow Admin to preview New Hire view via sidebar', async () => {
      render(<App />);

      // Login as admin
      const input = screen.getByPlaceholderText('name@industriousoffice.com');
      fireEvent.change(input, { target: { value: 'admin' } });
      fireEvent.click(screen.getByText('Sign In'));

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Click New Hire View in sidebar (shows as "New Hire View" for admins)
      fireEvent.click(screen.getByText('New Hire View'));

      // Should show New Hire dashboard content (welcome guide initially)
      expect(screen.getByText('Congratulations!')).toBeInTheDocument();
    });

    it('should maintain login session across view switches', async () => {
      render(<App />);

      // Login as admin
      const input = screen.getByPlaceholderText('name@industriousoffice.com');
      fireEvent.change(input, { target: { value: 'admin' } });
      fireEvent.click(screen.getByText('Sign In'));

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Switch between multiple views
      fireEvent.click(screen.getByText('Workflow & Tasks'));
      fireEvent.click(screen.getByText('New Bees & Cohorts'));
      fireEvent.click(screen.getByText('Dashboard'));

      // User should still be logged in (Sign Out button visible)
      expect(screen.getByText('Sign Out')).toBeInTheDocument();

      // Logout and verify return to login
      fireEvent.click(screen.getByText('Sign Out'));
      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    });
  });
});
