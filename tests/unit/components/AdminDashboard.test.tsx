import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminDashboard, { AdminViewMode } from '../../../components/AdminDashboard';
import { testAdmin } from '../../fixtures';

describe('AdminDashboard', () => {
  const mockSetViewMode = vi.fn();

  const defaultProps = {
    user: testAdmin,
    viewMode: 'dashboard' as AdminViewMode,
    setViewMode: mockSetViewMode,
  };

  beforeEach(() => {
    mockSetViewMode.mockClear();
  });

  describe('Task 3.1.1: Render Tests', () => {
    it('should render without crashing', () => {
      render(<AdminDashboard {...defaultProps} />);

      // Component should render
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
    });

    it('should display the default dashboard view when viewMode is dashboard', () => {
      render(<AdminDashboard {...defaultProps} viewMode="dashboard" />);

      // Dashboard view should show the title
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
      expect(screen.getByText('High-level status of Industrious onboarding.')).toBeInTheDocument();

      // Dashboard should show Pipeline Health section
      expect(screen.getByText('Pipeline Health')).toBeInTheDocument();

      // Dashboard should show AI Progress Intelligence section
      expect(screen.getByText('AI Progress Intelligence')).toBeInTheDocument();
    });
  });

  describe('Task 3.1.2: View Mode Tests', () => {
    it('should display workflow view when viewMode is workflow', () => {
      render(<AdminDashboard {...defaultProps} viewMode="workflow" />);

      expect(screen.getByText('Workflow & Tasks')).toBeInTheDocument();
      expect(screen.getByText('Import team members, manage active registry, and automate training.')).toBeInTheDocument();

      // Should show workflow sub-tabs
      expect(screen.getByText('Workday Import')).toBeInTheDocument();
      expect(screen.getByText('New Team Member')).toBeInTheDocument();
      expect(screen.getByText('Team Registry')).toBeInTheDocument();
      expect(screen.getByText('Upload Training')).toBeInTheDocument();
    });

    it('should display cohorts view when viewMode is cohorts', () => {
      render(<AdminDashboard {...defaultProps} viewMode="cohorts" />);

      expect(screen.getByText('New Bees & Cohorts')).toBeInTheDocument();
      expect(screen.getByText('Regional performance and manager drill-downs.')).toBeInTheDocument();

      // Should show All Regions breadcrumb
      expect(screen.getByText('All Regions')).toBeInTheDocument();
    });

    it('should display agenda view when viewMode is agenda', () => {
      render(<AdminDashboard {...defaultProps} viewMode="agenda" />);

      expect(screen.getByText('Agenda & Presenters')).toBeInTheDocument();

      // Should show calendar and presenter elements
      expect(screen.getByText('Sync Unit Ops Calendar')).toBeInTheDocument();
      expect(screen.getByText('Ops Training Calendar')).toBeInTheDocument();
      expect(screen.getByText('Presenter Tracker')).toBeInTheDocument();
    });

    it('should display communications view when viewMode is communications', () => {
      render(<AdminDashboard {...defaultProps} viewMode="communications" />);

      expect(screen.getByText('Communications')).toBeInTheDocument();

      // Should show target toggle buttons
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
});
