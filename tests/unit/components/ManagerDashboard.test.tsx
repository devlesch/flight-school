import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ManagerDashboard from '../../../components/ManagerDashboard';
import { ToastProvider } from '../../../components/Toast';
import { testManager } from '../../fixtures';

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

// Mock sendSlackDM so we can assert it was called with the hire's email.
const mockSendSlackDM = vi.fn();
vi.mock('../../../services/slackService', () => ({
  sendSlackDM: (...args: unknown[]) => mockSendSlackDM(...args),
}));

// Mock useCohortTeam so we can inject a deterministic hire that the manager
// can click into. Without this, the cohort fetch resolves against the (stubbed)
// supabase client and returns no members, so the drilldown modal never opens.
const slackTestHireProfile = {
  id: 'hire-slack-1',
  email: 'jordan.testhire@industriousoffice.com',
  name: 'Jordan Testhire',
  role: 'New Hire' as const,
  avatar: null,
  title: 'Member Experience Manager',
  region: 'Test Region',
  location: 'Brooklyn',
  standardized_role: 'MxA',
  manager_id: testManager.id,
  department: 'Operations',
  start_date: '2026-01-15',
  provisioned: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

vi.mock('../../../hooks/useCohortTeam', () => ({
  useCohortTeam: () => ({
    data: {
      cohort: {
        id: 'cohort-1',
        name: 'January 2026',
        hire_start_date: '2026-01-06',
        hire_end_date: '2026-01-17',
        created_at: '2026-01-01T00:00:00Z',
      },
      members: [
        {
          profile: slackTestHireProfile,
          progress: 50,
          modules: [],
          source: 'cohort',
        },
      ],
      leaders: [],
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

// useManagerTasks is unused by the Slack Nudge flow, but ManagerDashboard
// calls it at mount, so stub it to a no-op return.
vi.mock('../../../hooks/useManagerTasks', () => ({
  useManagerTasks: () => ({
    tasks: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
    toggleComplete: vi.fn(),
    initializeTasks: vi.fn(),
  }),
}));

// lessonlySyncService fires fire-and-forget on modal open — stub it.
vi.mock('../../../services/lessonlySyncService', () => ({
  syncLessonlyStatus: vi.fn().mockResolvedValue(undefined),
}));

describe('ManagerDashboard', () => {
  const defaultProps = {
    user: testManager,
  };

  describe('Task 3.2.1: Render Tests', () => {
    it('should render without crashing', () => {
      renderWithProviders(<ManagerDashboard {...defaultProps} />);

      // Component should render the welcome guide initially
      expect(screen.getByText(/Welcome,/)).toBeInTheDocument();
    });

    it('should display the manager\'s name in the welcome guide', () => {
      renderWithProviders(<ManagerDashboard {...defaultProps} />);

      // Should show welcome message with manager's first name
      expect(screen.getByText(`Welcome, ${testManager.name.split(' ')[0]}!`)).toBeInTheDocument();
    });

    it('should display welcome guide content', () => {
      renderWithProviders(<ManagerDashboard {...defaultProps} />);

      // Welcome guide shows these feature explanations
      expect(screen.getByText('Track Progress')).toBeInTheDocument();
      expect(screen.getByText('Identify Struggles')).toBeInTheDocument();
      expect(screen.getByText('Review Workbooks')).toBeInTheDocument();
      expect(screen.getByText('Get Started!')).toBeInTheDocument();
    });
  });

  describe('Task 3.2.2: Data Display Tests', () => {
    it('should show main dashboard after clicking Get Started', () => {
      renderWithProviders(<ManagerDashboard {...defaultProps} />);

      // Click Get Started button
      const getStartedButton = screen.getByText('Get Started!');
      fireEvent.click(getStartedButton);

      // Should now show the main dashboard - My Team appears in both h2 title and tab button
      const myTeamElements = screen.getAllByText('My Team');
      expect(myTeamElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Your Week at a Glance')).toBeInTheDocument();
    });

    it('should show tab navigation after dismissing welcome', () => {
      renderWithProviders(<ManagerDashboard {...defaultProps} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // Should have My Team and Tracker tabs
      const myTeamTabs = screen.getAllByText('My Team');
      expect(myTeamTabs.length).toBeGreaterThanOrEqual(2); // h2 title and tab button
      expect(screen.getByText('Tracker')).toBeInTheDocument();
    });

    it('should switch to tracker view when Tracker tab is clicked', () => {
      renderWithProviders(<ManagerDashboard {...defaultProps} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // Click Tracker tab
      fireEvent.click(screen.getByText('Tracker'));

      // Should show tracker-specific content
      expect(screen.getByText('Onboarding Tracker')).toBeInTheDocument();
      expect(screen.getByText('Pending Hires')).toBeInTheDocument();
      expect(screen.getByText('Pre-boarding Tasks')).toBeInTheDocument();
      expect(screen.getByText('Overall Completion')).toBeInTheDocument();
    });

    it('should display new hire cards in team view when hires exist', () => {
      renderWithProviders(<ManagerDashboard {...defaultProps} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // The component uses NEW_HIRES from constants, which should have data
      // We should see Progress label and percentage indicators
      expect(screen.getAllByText('Progress').length).toBeGreaterThanOrEqual(1);
    });

    it('should show search functionality in team view', () => {
      renderWithProviders(<ManagerDashboard {...defaultProps} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // Should have search input
      expect(screen.getByPlaceholderText('Search your team...')).toBeInTheDocument();
    });

    it('should show calendar week navigation in team view', () => {
      renderWithProviders(<ManagerDashboard {...defaultProps} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // Should show week at a glance header
      expect(screen.getByText('Your Week at a Glance')).toBeInTheDocument();
    });
  });

  describe('Task 1: Slack Nudge wired to sendSlackDM', () => {
    beforeEach(() => {
      mockSendSlackDM.mockReset();
      mockSendSlackDM.mockResolvedValue({ success: true, logged: true });
    });

    it('calls sendSlackDM with the hire email when Slack Nudge is clicked', async () => {
      renderWithProviders(<ManagerDashboard {...defaultProps} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // Open the hire drilldown modal by clicking the injected hire's card.
      // The card surfaces the hire's name as text.
      const hireCard = await screen.findByText(slackTestHireProfile.name);
      fireEvent.click(hireCard);

      // Click the Slack Nudge button in the drilldown footer.
      const slackButton = await screen.findByRole('button', { name: /slack nudge/i });
      fireEvent.click(slackButton);

      await waitFor(() => {
        expect(mockSendSlackDM).toHaveBeenCalledTimes(1);
      });

      const [emailArg, bodyArg, optsArg] = mockSendSlackDM.mock.calls[0];
      expect(emailArg).toBe(slackTestHireProfile.email);
      expect(bodyArg).toBe('Hi Jordan! Checking in on your workbook progress.');
      expect(optsArg).toMatchObject({ title: 'A note for Jordan', kind: 'slack' });
      // `from` must be the signed-in user's name so recipients know who triggered it.
      expect(optsArg.from).toBe(testManager.name);
    });
  });
});
