import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AdminDashboard, { AdminViewMode } from '../../../components/AdminDashboard';
import { testAdmin } from '../../fixtures';

// Mock profileService
const mockUpdateProfile = vi.fn().mockResolvedValue({ id: 'profile-1' });
vi.mock('../../../services/profileService', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

// Mock moduleService
const mockCreateModule = vi.fn();
const mockUpdateModule = vi.fn();
const testModule = {
  id: 'mod-1',
  title: 'Existing Module',
  description: null,
  type: 'MANAGER_LED',
  duration: null,
  link: 'https://example.com',
  host: null,
  sort_order: 0,
  target_role: 'MxA',
  created_at: '2026-01-01T00:00:00Z',
};
const mockGetModules = vi.fn().mockResolvedValue([testModule]);
vi.mock('../../../services/moduleService', () => ({
  createModule: (...args: unknown[]) => mockCreateModule(...args),
  updateModule: (...args: unknown[]) => mockUpdateModule(...args),
  getModules: (...args: unknown[]) => mockGetModules(...args),
  getUserModules: vi.fn().mockResolvedValue([]),
  getModulesWithProgress: vi.fn().mockResolvedValue([]),
  updateModuleProgress: vi.fn().mockResolvedValue(null),
  markModuleComplete: vi.fn().mockResolvedValue(null),
  toggleModuleLike: vi.fn().mockResolvedValue(null),
}));

// Mock useTeam (useAllUsers)
const testProfile = {
  id: 'profile-1',
  email: 'jane@test.com',
  name: 'Jane Leader',
  role: 'Manager' as const,
  avatar: null,
  title: 'Manager',
  region: 'East',
  location: 'Brooklyn',
  standardized_role: 'MxA',
  manager_id: null,
  department: null,
  start_date: null,
  provisioned: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
vi.mock('../../../hooks/useTeam', () => ({
  useAllUsers: () => ({
    users: [testProfile],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

// Mock cohortService
const mockUpsertCohortLeader = vi.fn().mockResolvedValue(true);
vi.mock('../../../services/cohortService', () => ({
  createCohort: vi.fn().mockResolvedValue(null),
  upsertCohortLeader: (...args: unknown[]) => mockUpsertCohortLeader(...args),
  LEADER_ROLE_TITLE_PATTERNS: {
    MxA: (title: string) => /manager/i.test(title) && !/general manager/i.test(title) && !/assistant general manager/i.test(title),
    MxM: (title: string) => /assistant general manager/i.test(title) || (/general manager/i.test(title) && !/assistant/i.test(title)),
    AGM: (title: string) => /regional director/i.test(title) || /\bRD\b/.test(title),
    GM: (title: string) => /regional director/i.test(title) || /\bRD\b/.test(title),
  },
}));

// Mock useCohorts
const mockRefetchCohorts = vi.fn().mockResolvedValue(undefined);
const testCohort = {
  id: 'cohort-1',
  name: 'January 2026',
  hire_start_date: '2026-01-06',
  hire_end_date: '2026-01-17',
  created_at: '2026-01-01T00:00:00Z',
  cohort_leaders: [
    {
      id: 'cl-1',
      cohort_id: 'cohort-1',
      role_label: 'MxA',
      region: 'East',
      profile_id: 'profile-1',
      created_at: '2026-01-01T00:00:00Z',
      profiles: {
        id: 'profile-1',
        email: 'jane@test.com',
        name: 'Jane Leader',
        role: 'Manager' as const,
        avatar: null,
        title: 'Manager',
        region: 'East',
        location: 'Brooklyn',
        standardized_role: 'MxA',
        manager_id: null,
        department: null,
        start_date: null,
        provisioned: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    },
  ],
};
vi.mock('../../../hooks/useCohorts', () => ({
  useCohorts: () => ({
    cohorts: [testCohort],
    loading: false,
    error: null,
    refetch: mockRefetchCohorts,
  }),
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
    mockUpdateModule.mockClear();
    mockUpdateProfile.mockClear();
    mockUpsertCohortLeader.mockClear();
    mockRefetchCohorts.mockClear();
    mockGetModules.mockClear().mockResolvedValue([testModule]);
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
      expect(screen.getByText('People')).toBeInTheDocument();
      expect(screen.getByText('Import team members, manage active registry, and automate training.')).toBeInTheDocument();
      expect(screen.getByText('Workday Import')).toBeInTheDocument();
      expect(screen.getByText('New Team Member')).toBeInTheDocument();
      expect(screen.getByText('Team Registry')).toBeInTheDocument();
      expect(screen.queryByText('Upload Task')).not.toBeInTheDocument();
    });

    it('should display cohorts view when viewMode is cohorts', () => {
      render(<AdminDashboard {...defaultProps} viewMode="cohorts" />);
      expect(screen.getByText('New Bees & Cohorts')).toBeInTheDocument();
      expect(screen.getByText('Regional performance and manager drill-downs.')).toBeInTheDocument();
      expect(screen.getByText('All Cohorts')).toBeInTheDocument();
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
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Platform Controls')).toBeInTheDocument();
      expect(screen.getByText(/Manage team permissions, branding assets/i)).toBeInTheDocument();
    });

    it('should display tasks view when viewMode is tasks', () => {
      render(<AdminDashboard {...defaultProps} viewMode="tasks" />);
      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('Manage training modules and assignments.')).toBeInTheDocument();
      expect(screen.getByText('Task Registry')).toBeInTheDocument();
    });
  });

  describe('Task Builder modal', () => {
    const renderTasks = () =>
      render(<AdminDashboard {...defaultProps} viewMode="tasks" />);

    const openTaskBuilder = () => {
      fireEvent.click(screen.getByRole('button', { name: /new task/i }));
    };

    it('renders "New Task" button on Tasks page', () => {
      renderTasks();
      expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument();
    });

    it('renders "Task Builder" heading when modal is open', () => {
      renderTasks();
      openTaskBuilder();
      expect(screen.getByText('Task Builder')).toBeInTheDocument();
    });

    it('renders Module/Call segmented control with Module active by default', () => {
      renderTasks();
      openTaskBuilder();
      expect(screen.getByRole('button', { name: /^module$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^call$/i })).toBeInTheDocument();
    });

    it('shows Method dropdown when Module is selected', () => {
      renderTasks();
      openTaskBuilder();
      expect(screen.getByLabelText(/method/i)).toBeInTheDocument();
    });

    it('hides Method dropdown and shows link field prominently when Call is selected', () => {
      renderTasks();
      openTaskBuilder();
      fireEvent.click(screen.getByRole('button', { name: /^call$/i }));
      expect(screen.queryByLabelText(/method/i)).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/lessonly|google/i)).toBeInTheDocument();
    });

    it('hides Workbook Prompt toggle when Call is selected', () => {
      renderTasks();
      openTaskBuilder();
      expect(screen.getByText('Workbook Prompt')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^call$/i }));
      expect(screen.queryByText('Workbook Prompt')).not.toBeInTheDocument();
    });

    it('calls createModule with correct payload including type LIVE_CALL when Call is selected', async () => {
      mockCreateModule.mockResolvedValue({ id: 'new-id', title: 'Test Call', type: 'LIVE_CALL' });
      renderTasks();
      openTaskBuilder();

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
      renderTasks();
      openTaskBuilder();

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
      renderTasks();
      openTaskBuilder();

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
      renderTasks();
      openTaskBuilder();

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

    it('clicking a task row opens the modal with pre-populated data', async () => {
      renderTasks();
      // Wait for modules to load
      await waitFor(() => {
        expect(screen.getByText('Existing Module')).toBeInTheDocument();
      });
      // Click the task row
      fireEvent.click(screen.getByText('Existing Module'));
      // Modal should open
      expect(screen.getByText('Task Builder')).toBeInTheDocument();
      expect(screen.getByText('Edit existing task')).toBeInTheDocument();
      // Title should be pre-populated
      expect(screen.getByDisplayValue('Existing Module')).toBeInTheDocument();
      // Link should be pre-populated
      expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument();
    });

    it('shows "Update Task" button in edit mode', async () => {
      renderTasks();
      await waitFor(() => {
        expect(screen.getByText('Existing Module')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Existing Module'));
      expect(screen.getByRole('button', { name: /update task/i })).toBeInTheDocument();
    });

    it('calls updateModule (not createModule) when submitting in edit mode', async () => {
      mockUpdateModule.mockResolvedValue({ ...testModule, title: 'Updated' });
      renderTasks();
      await waitFor(() => {
        expect(screen.getByText('Existing Module')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Existing Module'));

      await act(async () => {
        fireEvent.submit(screen.getByRole('button', { name: /update task/i }).closest('form')!);
      });

      await waitFor(() => {
        expect(mockUpdateModule).toHaveBeenCalledWith('mod-1', expect.objectContaining({
          title: 'Existing Module',
          type: 'MANAGER_LED',
          link: 'https://example.com',
          target_role: 'MxA',
        }));
        expect(mockCreateModule).not.toHaveBeenCalled();
      });
    });

    it('"New Task" button opens blank create-mode modal after editing', async () => {
      renderTasks();
      await waitFor(() => {
        expect(screen.getByText('Existing Module')).toBeInTheDocument();
      });
      // First open edit modal
      fireEvent.click(screen.getByText('Existing Module'));
      expect(screen.getByText('Edit existing task')).toBeInTheDocument();
      // Close it via the backdrop's X button (find the button containing the X svg near the modal header)
      const editSubtitle = screen.getByText('Edit existing task');
      const headerDiv = editSubtitle.closest('div[class*="flex items-center justify-between"]')!;
      const closeBtn = headerDiv.querySelector('button')!;
      fireEvent.click(closeBtn);
      // Now open via New Task
      fireEvent.click(screen.getByRole('button', { name: /new task/i }));
      expect(screen.getByText('Multi-method training mapping')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /assign resource/i })).toBeInTheDocument();
    });
  });

  describe('Registry Region column', () => {
    const renderWorkflow = () =>
      render(<AdminDashboard {...defaultProps} viewMode="workflow" />);

    const openRegistryTab = () => {
      const tab = screen.getByRole('button', { name: /team registry/i });
      fireEvent.click(tab);
    };

    it('renders Region column header in registry table', () => {
      renderWorkflow();
      openRegistryTab();
      const headers = screen.getAllByRole('columnheader');
      const regionHeader = headers.find(h => h.textContent?.includes('Region'));
      expect(regionHeader).toBeDefined();
    });

    it('renders inline region select with correct value for assigned user', () => {
      renderWorkflow();
      openRegistryTab();
      // The profile has region: 'East', so the inline select should show East
      const selects = screen.getAllByDisplayValue('East');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Registry Std. Role column', () => {
    const renderWorkflow = () =>
      render(<AdminDashboard {...defaultProps} viewMode="workflow" />);

    const openRegistryTab = () => {
      const tab = screen.getByRole('button', { name: /team registry/i });
      fireEvent.click(tab);
    };

    it('renders Std. Role column header in registry table', () => {
      renderWorkflow();
      openRegistryTab();
      const headers = screen.getAllByRole('columnheader');
      const stdRoleHeader = headers.find(h => h.textContent?.includes('Std. Role'));
      expect(stdRoleHeader).toBeDefined();
    });

    it('renders inline standardized role select with correct value', () => {
      renderWorkflow();
      openRegistryTab();
      const selects = screen.getAllByDisplayValue('MxA');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Cohort Leader Grid', () => {
    const renderCohorts = () =>
      render(<AdminDashboard {...defaultProps} viewMode="cohorts" />);

    it('renders 3 region cards with role labels when drilled into a cohort', () => {
      renderCohorts();
      fireEvent.click(screen.getByText('January 2026'));

      expect(screen.getByText('Training Leaders')).toBeInTheDocument();
      expect(screen.getByText('1 / 12 slots assigned')).toBeInTheDocument();

      // Region card headers
      expect(screen.getByText('East Region')).toBeInTheDocument();
      expect(screen.getByText('Central Region')).toBeInTheDocument();
      expect(screen.getByText('West Region')).toBeInTheDocument();

      // Role labels appear in each region (4 roles × 3 regions = 12)
      const mxaLabels = screen.getAllByText('MxA');
      expect(mxaLabels.length).toBe(3);
    });

    it('shows assigned leader with progress stats and unassigned dropdowns', () => {
      renderCohorts();
      fireEvent.click(screen.getByText('January 2026'));

      // The assigned leader (MxA-East) should show the name (may appear in dropdown options too)
      const janeElements = screen.getAllByText('Jane Leader');
      expect(janeElements.length).toBeGreaterThanOrEqual(1);

      // Assigned leader should show progress stats
      expect(screen.getByText('1 / 4 assigned')).toBeInTheDocument(); // East region badge

      // Unassigned slots should have dropdowns with "Unassigned" text
      const unassignedOptions = screen.getAllByText('— Unassigned —');
      expect(unassignedOptions.length).toBe(11); // 12 slots - 1 assigned = 11
    });

    it('renders unassigned slots as select dropdowns inside region cards', () => {
      renderCohorts();
      fireEvent.click(screen.getByText('January 2026'));

      const unassignedOptions = screen.getAllByText('— Unassigned —');
      expect(unassignedOptions.length).toBe(11);
      unassignedOptions.forEach(opt => {
        expect(opt.closest('select')).not.toBeNull();
      });
    });

    it('shows slot-based breadcrumb with region and role after clicking a leader row', () => {
      renderCohorts();
      fireEvent.click(screen.getByText('January 2026'));
      // Click the leader name in the row (the <p> element, not option elements)
      const janeElements = screen.getAllByText('Jane Leader');
      const janeParagraph = janeElements.find(el => el.tagName === 'P')!;
      fireEvent.click(janeParagraph);

      // Breadcrumb should show region and role, not the manager name
      expect(screen.getByText('East')).toBeInTheDocument();
      // MxA appears in breadcrumb
      const mxaElements = screen.getAllByText('MxA');
      expect(mxaElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows cohort members section when drilled into a leader slot', () => {
      renderCohorts();
      fireEvent.click(screen.getByText('January 2026'));
      const janeElements = screen.getAllByText('Jane Leader');
      const janeParagraph = janeElements.find(el => el.tagName === 'P')!;
      fireEvent.click(janeParagraph);

      // Should show the cohort members heading with role and region
      expect(screen.getByText(/MxA Members — East Region/)).toBeInTheDocument();
    });

    it('shows role-based heading and reassign select in the detail view', () => {
      renderCohorts();
      fireEvent.click(screen.getByText('January 2026'));
      // Click the leader name in the row (the <p> element, not option elements)
      const janeElements = screen.getAllByText('Jane Leader');
      const janeParagraph = janeElements.find(el => el.tagName === 'P')!;
      fireEvent.click(janeParagraph);

      // Detail header should show role as heading
      expect(screen.getByText('MxA Leader')).toBeInTheDocument();

      // Back button should reference the region
      expect(screen.getByText(/Back to East Region/)).toBeInTheDocument();

      // Reassign select should be present in the header (the one with the current manager as selected option)
      const headerDiv = screen.getByText('MxA Leader').closest('div')!;
      const reassignSelect = headerDiv.querySelector('select');
      expect(reassignSelect).not.toBeNull();
      expect(reassignSelect!.value).toBe('profile-1');
    });
  });
});
