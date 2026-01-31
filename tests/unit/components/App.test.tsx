import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../../../App';

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Task 4.1.1: Render Tests', () => {
    it('should render Login screen when no user is logged in', () => {
      render(<App />);

      // Should show Login screen elements
      expect(screen.getByText('Great days start here.')).toBeInTheDocument();
      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('name@industriousoffice.com')).toBeInTheDocument();
    });

    it('should show login error for invalid credentials', async () => {
      render(<App />);

      // Enter invalid credentials
      const input = screen.getByPlaceholderText('name@industriousoffice.com');
      fireEvent.change(input, { target: { value: 'invaliduser' } });

      // Submit form
      const submitButton = screen.getByText('Sign In');
      fireEvent.click(submitButton);

      // Advance timers to process login
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should show error message
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });
  });

  describe('Task 4.1.2: Role-based Rendering Tests', () => {
    it('should render AdminDashboard when admin user logs in', async () => {
      render(<App />);

      // Login as admin
      const input = screen.getByPlaceholderText('name@industriousoffice.com');
      fireEvent.change(input, { target: { value: 'admin' } });
      fireEvent.click(screen.getByText('Sign In'));

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should show AdminDashboard
      expect(screen.getByText('Operations Admin Portal')).toBeInTheDocument();
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
    });

    it('should render ManagerDashboard when manager user logs in', async () => {
      render(<App />);

      // Login as manager
      const input = screen.getByPlaceholderText('name@industriousoffice.com');
      fireEvent.change(input, { target: { value: 'manager' } });
      fireEvent.click(screen.getByText('Sign In'));

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should show ManagerDashboard header (appears in sidebar button and h1)
      const managerOverviewElements = screen.getAllByText('Manager Overview');
      expect(managerOverviewElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should render NewHireDashboard when new hire user logs in', async () => {
      render(<App />);

      // Login as new hire
      const input = screen.getByPlaceholderText('name@industriousoffice.com');
      fireEvent.change(input, { target: { value: 'new' } });
      fireEvent.click(screen.getByText('Sign In'));

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should show NewHireDashboard header
      expect(screen.getByText('Onboarding Journey')).toBeInTheDocument();
    });
  });

  describe('Task 4.1.3: Navigation Tests', () => {
    it('should render sidebar navigation for logged-in admin users', async () => {
      render(<App />);

      // Login as admin
      const input = screen.getByPlaceholderText('name@industriousoffice.com');
      fireEvent.change(input, { target: { value: 'admin' } });
      fireEvent.click(screen.getByText('Sign In'));

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should show sidebar navigation items
      expect(screen.getByText('Admin Console')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Workflow & Tasks')).toBeInTheDocument();
      expect(screen.getByText('New Bees & Cohorts')).toBeInTheDocument();
    });

    it('should switch to workflow view when Workflow button is clicked', async () => {
      render(<App />);

      // Login as admin
      const input = screen.getByPlaceholderText('name@industriousoffice.com');
      fireEvent.change(input, { target: { value: 'admin' } });
      fireEvent.click(screen.getByText('Sign In'));

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Click Workflow & Tasks in sidebar
      fireEvent.click(screen.getByText('Workflow & Tasks'));

      // The AdminDashboard should now show Workflow view subtitle
      expect(screen.getByText('Import team members, manage active registry, and automate training.')).toBeInTheDocument();
    });

    it('should return to Login screen when Sign Out is clicked', async () => {
      render(<App />);

      // Login as admin
      const input = screen.getByPlaceholderText('name@industriousoffice.com');
      fireEvent.change(input, { target: { value: 'admin' } });
      fireEvent.click(screen.getByText('Sign In'));

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Click Sign Out
      fireEvent.click(screen.getByText('Sign Out'));

      // Should return to Login screen
      expect(screen.getByText('Great days start here.')).toBeInTheDocument();
      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    });

    it('should show demo login buttons that fill credentials', () => {
      render(<App />);

      // Click admin demo button
      const adminButton = screen.getByRole('button', { name: 'admin' });
      fireEvent.click(adminButton);

      // Input should be filled with 'admin'
      const input = screen.getByPlaceholderText('name@industriousoffice.com') as HTMLInputElement;
      expect(input.value).toBe('admin');
    });
  });
});
