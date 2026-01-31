import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ManagerDashboard from '../../../components/ManagerDashboard';
import { testManager } from '../../fixtures';

describe('ManagerDashboard', () => {
  const defaultProps = {
    user: testManager,
  };

  describe('Task 3.2.1: Render Tests', () => {
    it('should render without crashing', () => {
      render(<ManagerDashboard {...defaultProps} />);

      // Component should render the welcome guide initially
      expect(screen.getByText(/Welcome,/)).toBeInTheDocument();
    });

    it('should display the manager\'s name in the welcome guide', () => {
      render(<ManagerDashboard {...defaultProps} />);

      // Should show welcome message with manager's first name
      expect(screen.getByText(`Welcome, ${testManager.name.split(' ')[0]}!`)).toBeInTheDocument();
    });

    it('should display welcome guide content', () => {
      render(<ManagerDashboard {...defaultProps} />);

      // Welcome guide shows these feature explanations
      expect(screen.getByText('Track Progress')).toBeInTheDocument();
      expect(screen.getByText('Identify Struggles')).toBeInTheDocument();
      expect(screen.getByText('Review Workbooks')).toBeInTheDocument();
      expect(screen.getByText('Get Started!')).toBeInTheDocument();
    });
  });

  describe('Task 3.2.2: Data Display Tests', () => {
    it('should show main dashboard after clicking Get Started', () => {
      render(<ManagerDashboard {...defaultProps} />);

      // Click Get Started button
      const getStartedButton = screen.getByText('Get Started!');
      fireEvent.click(getStartedButton);

      // Should now show the main dashboard - My Team appears in both h2 title and tab button
      const myTeamElements = screen.getAllByText('My Team');
      expect(myTeamElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Your Week at a Glance')).toBeInTheDocument();
    });

    it('should show tab navigation after dismissing welcome', () => {
      render(<ManagerDashboard {...defaultProps} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // Should have My Team and Tracker tabs
      const myTeamTabs = screen.getAllByText('My Team');
      expect(myTeamTabs.length).toBeGreaterThanOrEqual(2); // h2 title and tab button
      expect(screen.getByText('Tracker')).toBeInTheDocument();
    });

    it('should switch to tracker view when Tracker tab is clicked', () => {
      render(<ManagerDashboard {...defaultProps} />);

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
      render(<ManagerDashboard {...defaultProps} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // The component uses NEW_HIRES from constants, which should have data
      // We should see Progress label and percentage indicators
      expect(screen.getAllByText('Progress').length).toBeGreaterThanOrEqual(1);
    });

    it('should show search functionality in team view', () => {
      render(<ManagerDashboard {...defaultProps} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // Should have search input
      expect(screen.getByPlaceholderText('Search your team...')).toBeInTheDocument();
    });

    it('should show calendar week navigation in team view', () => {
      render(<ManagerDashboard {...defaultProps} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // Should show week at a glance header
      expect(screen.getByText('Your Week at a Glance')).toBeInTheDocument();
    });
  });
});
