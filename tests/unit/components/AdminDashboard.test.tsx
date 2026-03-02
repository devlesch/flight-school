import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AdminDashboard, { AdminViewMode } from '../../../components/AdminDashboard';
import { testAdmin } from '../../fixtures';

// Mock moduleService
const mockCreateModule = vi.fn();
vi.mock('../../../services/moduleService', () => ({
  createModule: (...args: unknown[]) => mockCreateModule(...args),
  getModules: vi.fn().mockResolvedValue([]),
  getUserModules: vi.fn().mockResolvedValue([]),
  getModulesWithProgress: vi.fn().mockResolvedValue([]),
  updateModuleProgress: vi.fn().mockResolvedValue(null),
  markModuleComplete: vi.fn().mockResolvedValue(null),
  toggleModuleLike: vi.fn().mockResolvedValue(null),
}));

describe('AdminDashboard', () => {
  const mockSetViewMode = vi.fn();

  const defaultProps = {
    user: testAdmin,
    viewMode: 'dashboard' as AdminViewMode,
    setViewMode: mockSetViewMode,
  };

  beforeEach(() => {
    mockSetViewMode.mockClear();
    mockCreateModule.mockClear();
  });

  describe('Task 3.1.1: Render Tests', () => {
    it('should render without crashing', () => {
      render(<AdminDashboard {...defaultProps} />);
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
    });

    it('should display the default dashboard view when viewMode is dashboard', () => {
      render(<AdminDashboard {...defaultProps} viewMode="dashboard" />);
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
      expect(screen.getByText('High-level status of Industrious onboarding.')).toBeInTheDocument();
      expect(screen.getByText('Pipeline Health')).toBeInTheDocument();
      expect(screen.getByText('AI Progress Intelligence')).toBeInTheDocument();
    });
  });

  describe('Task 3.1.2: View Mode Tests', () => {
    it('should display workflow view when viewMode is workflow', () => {
      render(<AdminDashboard {...defaultProps} viewMode="workflow" />);
      expect(screen.getByText('Workflow & Tasks')).toBeInTheDocument();
      expect(screen.getByText('Import team members, manage active registry, and automate training.')).toBeInTheDocument();
      expect(screen.getByText('Workday Import')).toBeInTheDocument();
      expect(screen.getByText('New Team Member')).toBeInTheDocument();
      expect(screen.getByText('Team Registry')).toBeInTheDocument();
    });

    it('should display cohorts view when viewMode is cohorts', () => {
      render(<AdminDashboard {...defaultProps} viewMode="cohorts" />);
      expect(screen.getByText('New Bees & Cohorts')).toBeInTheDocument();
      expect(screen.getByText('Regional performance and manager drill-downs.')).toBeInTheDocument();
      expect(screen.getByText('All Regions')).toBeInTheDocument();
    });

    it('should display agenda view when viewMode is agenda', () => {
      render(<AdminDashboard {...defaultProps} viewMode="agenda" />);
      expect(screen.getByText('Agenda & Presenters')).toBeInTheDocument();
      expect(screen.getByText('Sync Unit Ops Calendar')).toBeInTheDocument();
      expect(screen.getByText('Ops Training Calendar')).toBeInTheDocument();
      expect(screen.getByText('Presenter Tracker')).toBeInTheDocument();
    });

    it('should display communications view when viewMode is communications', () => {
      render(<AdminDashboard {...defaultProps} viewMode="communications" />);
      expect(screen.getByText('Communications')).toBeInTheDocument();
      expect(screen.getByText('New Hires')).toBeInTheDocument();
      expect(screen.getByText('Managers')).toBeInTheDocument();
    });

    it('should display engagement view when viewMode is engagement', () => {
      render(<AdminDashboard {...defaultProps} viewMode="engagement" />);
      expect(screen.getByText('Cohort Engagement')).toBeInTheDocument();
      expect(screen.getByText('Cohort Engagement Visualizer')).toBeInTheDocument();
      expect(screen.getByText(/participation trends and sentiment analysis/i)).toBeInTheDocument();
    });

    it('should display settings view when viewMode is settings', () => {
      render(<AdminDashboard {...defaultProps} viewMode="settings" />);
      expect(screen.getByText('Settings & Branding')).toBeInTheDocument();
      expect(screen.getByText('Platform Controls')).toBeInTheDocument();
      expect(screen.getByText(/Manage team permissions, branding assets/i)).toBeInTheDocument();
    });
  });

  describe('Upload Task tab', () => {
    const renderWorkflow = () =>
      render(<AdminDashboard {...defaultProps} viewMode="workflow" />);

    const openTaskTab = () => {
      const tab = screen.getByRole('button', { name: /upload task/i });
      fireEvent.click(tab);
    };

    it('renders "Upload Task" tab label (not "Upload Training")', () => {
      renderWorkflow();
      expect(screen.getByRole('button', { name: /upload task/i })).toBeInTheDocument();
      expect(screen.queryByText('Upload Training')).not.toBeInTheDocument();
    });

    it('renders "Task Builder" heading when tab is active', () => {
      renderWorkflow();
      openTaskTab();
      expect(screen.getByText('Task Builder')).toBeInTheDocument();
    });

    it('renders Module/Call segmented control with Module active by default', () => {
      renderWorkflow();
      openTaskTab();
      expect(screen.getByRole('button', { name: /^module$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^call$/i })).toBeInTheDocument();
    });

    it('shows Method dropdown when Module is selected', () => {
      renderWorkflow();
      openTaskTab();
      expect(screen.getByLabelText(/method/i)).toBeInTheDocument();
    });

    it('hides Method dropdown and shows link field prominently when Call is selected', () => {
      renderWorkflow();
      openTaskTab();
      fireEvent.click(screen.getByRole('button', { name: /^call$/i }));
      expect(screen.queryByLabelText(/method/i)).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/lessonly|google/i)).toBeInTheDocument();
    });

    it('hides Workbook Prompt toggle when Call is selected', () => {
      renderWorkflow();
      openTaskTab();
      expect(screen.getByText('Workbook Prompt')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^call$/i }));
      expect(screen.queryByText('Workbook Prompt')).not.toBeInTheDocument();
    });

    it('calls createModule with correct payload including type LIVE_CALL when Call is selected', async () => {
      mockCreateModule.mockResolvedValue({ id: 'new-id', title: 'Test Call', type: 'LIVE_CALL' });
      renderWorkflow();
      openTaskTab();

      fireEvent.click(screen.getByRole('button', { name: /^call$/i }));
      fireEvent.change(screen.getByPlaceholderText(/member crisis/i), {
        target: { value: 'Onboarding Call' },
      });
      fireEvent.change(screen.getByPlaceholderText(/lessonly|google/i), {
        target: { value: 'https://app.lessonly.com/lesson/42' },
      });

      await act(async () => {
        fireEvent.submit(screen.getByRole('button', { name: /assign resource/i }).closest('form')!);
      });

      await waitFor(() => {
        expect(mockCreateModule).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Onboarding Call',
            type: 'LIVE_CALL',
            link: 'https://app.lessonly.com/lesson/42',
          })
        );
      });
    });

    it('passes null for target_role when "All Roles" is selected', async () => {
      mockCreateModule.mockResolvedValue({ id: 'new-id', title: 'Test', type: 'MANAGER_LED' });
      renderWorkflow();
      openTaskTab();

      fireEvent.change(screen.getByPlaceholderText(/member crisis/i), {
        target: { value: 'Test Task' },
      });

      await act(async () => {
        fireEvent.submit(screen.getByRole('button', { name: /assign resource/i }).closest('form')!);
      });

      await waitFor(() => {
        expect(mockCreateModule).toHaveBeenCalledWith(
          expect.objectContaining({ target_role: null })
        );
      });
    });

    it('shows success state after successful submit', async () => {
      mockCreateModule.mockResolvedValue({ id: 'new-id', title: 'Test', type: 'MANAGER_LED' });
      renderWorkflow();
      openTaskTab();

      fireEvent.change(screen.getByPlaceholderText(/member crisis/i), {
        target: { value: 'Test Task' },
      });

      await act(async () => {
        fireEvent.submit(screen.getByRole('button', { name: /assign resource/i }).closest('form')!);
      });

      await waitFor(() => {
        expect(screen.getByText(/task assigned/i)).toBeInTheDocument();
      });
    });

    it('shows error message when createModule returns null', async () => {
      mockCreateModule.mockResolvedValue(null);
      renderWorkflow();
      openTaskTab();

      fireEvent.change(screen.getByPlaceholderText(/member crisis/i), {
        target: { value: 'Test Task' },
      });

      await act(async () => {
        fireEvent.submit(screen.getByRole('button', { name: /assign resource/i }).closest('form')!);
      });

      await waitFor(() => {
        expect(screen.getByText(/failed to save task/i)).toBeInTheDocument();
      });
    });
  });
});
