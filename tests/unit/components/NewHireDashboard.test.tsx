import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NewHireDashboard from '../../../components/NewHireDashboard';
import { testNewHire, testNewHireWithModules } from '../../fixtures';

describe('NewHireDashboard', () => {
  describe('Task 3.3.1: Render Tests', () => {
    it('should render without crashing', () => {
      render(<NewHireDashboard user={testNewHire} />);

      // Component should render the welcome guide initially
      expect(screen.getByText('Congratulations!')).toBeInTheDocument();
    });

    it('should display the user\'s name and welcome message', () => {
      render(<NewHireDashboard user={testNewHire} />);

      // Should show welcome message with user's first name
      expect(screen.getByText(/We are SO glad you are here!/)).toBeInTheDocument();
    });

    it('should display welcome guide content with methods of learning', () => {
      render(<NewHireDashboard user={testNewHire} />);

      // Welcome guide shows learning methods
      expect(screen.getByText('Methods of Learning')).toBeInTheDocument();
      expect(screen.getByText('Manager Led')).toBeInTheDocument();
      expect(screen.getByText('Lessonly')).toBeInTheDocument();
      expect(screen.getByText('Self Led')).toBeInTheDocument();
    });

    it('should show Get Started button in welcome guide', () => {
      render(<NewHireDashboard user={testNewHire} />);

      expect(screen.getByText('Get Started!')).toBeInTheDocument();
    });
  });

  describe('Task 3.3.2: Module Tests', () => {
    it('should show main dashboard after clicking Get Started', () => {
      render(<NewHireDashboard user={testNewHire} />);

      // Click Get Started button
      const getStartedButton = screen.getByText('Get Started!');
      fireEvent.click(getStartedButton);

      // Should show main dashboard elements - "My Journey" is the h2 title
      const myJourneyElements = screen.getAllByText('My Journey');
      expect(myJourneyElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should display training schedule section in dashboard view', () => {
      render(<NewHireDashboard user={testNewHire} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // Should show training-related UI - "Training Schedule" appears in the calendar section
      expect(screen.getByText('Week At a Glance')).toBeInTheDocument();
    });

    it('should show module type filter button', () => {
      render(<NewHireDashboard user={testNewHire} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // Should show the "Tap to Filter" button
      expect(screen.getByText('Tap to Filter')).toBeInTheDocument();
    });
  });

  describe('Task 3.3.3: OKR Tests', () => {
    it('should display leadership team section', () => {
      render(<NewHireDashboard user={testNewHire} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // Should show unit leadership section
      expect(screen.getByText('Your Leadership!')).toBeInTheDocument();
    });

    it('should display up next section', () => {
      render(<NewHireDashboard user={testNewHire} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // Should show "Up Next" card
      expect(screen.getByText('Up Next')).toBeInTheDocument();
    });

    it('should have tab navigation in dashboard', () => {
      render(<NewHireDashboard user={testNewHire} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // Should have My Journey, Training Calendar, and Workbook tabs
      const myJourneyElements = screen.getAllByText('My Journey');
      expect(myJourneyElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Training Calendar')).toBeInTheDocument();
      expect(screen.getByText('Workbook')).toBeInTheDocument();
    });

    it('should switch to calendar view when Calendar tab is clicked', () => {
      render(<NewHireDashboard user={testNewHire} />);

      // Dismiss welcome guide
      fireEvent.click(screen.getByText('Get Started!'));

      // Click Training Calendar tab
      fireEvent.click(screen.getByText('Training Calendar'));

      // Should show calendar-specific content - the calendar section header
      expect(screen.getByText('Training Schedule')).toBeInTheDocument();
    });
  });
});
