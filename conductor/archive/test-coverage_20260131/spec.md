# Specification: Test Coverage for Core Dashboard Components

## Overview

Establish a comprehensive testing foundation for the Industrious Flight School application using Vitest and React Testing Library. This track focuses on adding unit and integration tests for the three core dashboard components (AdminDashboard, ManagerDashboard, NewHireDashboard) and critical application logic.

## Background

The project currently has **zero test coverage** despite the workflow.md mandating 80% coverage and TDD practices. This creates risk when adding features or refactoring code. This track establishes the testing infrastructure and initial coverage to enable confident future development.

## Functional Requirements

### FR1: Testing Infrastructure Setup
- Install and configure Vitest as the test runner
- Configure React Testing Library for component testing
- Set up jsdom as the test environment
- Create global test setup file with common imports and mocks
- Add test scripts to package.json (`test`, `test:coverage`)

### FR2: Mock Infrastructure
- Create mock for `geminiService.ts` to avoid AI API calls in tests
- Create mock for Recharts components (SVG rendering issues in jsdom)
- Set up test fixtures leveraging existing `constants.ts` data

### FR3: Dashboard Component Tests
- **AdminDashboard**: Test view mode switching between all 7 modes (dashboard, workflow, cohorts, agenda, communications, engagement, settings)
- **ManagerDashboard**: Test new hire list rendering and manager task tracking display
- **NewHireDashboard**: Test module list rendering, progress display, and OKR section

### FR4: App Component Tests
- Test role-based dashboard rendering (Admin → AdminDashboard, Manager → ManagerDashboard, New Hire → NewHireDashboard)
- Test login/logout state transitions
- Test sidebar navigation and view switching

### FR5: Integration Tests
- Test role switching flow (user logs in → sees correct dashboard)
- Test module completion state updates

## Non-Functional Requirements

### NFR1: Coverage Thresholds
- Minimum 60% line coverage (foundation for reaching 80%)
- Minimum 50% branch coverage
- Coverage thresholds enforced in Vitest config

### NFR2: Test Performance
- Full test suite should run in under 30 seconds
- Individual test files should run in under 5 seconds

### NFR3: Test Reliability
- Zero flaky tests (must pass consistently on 10 consecutive runs)
- No skipped tests in final suite
- No test warnings

## Technical Constraints

- Must use Vitest (native Vite integration)
- Must use React Testing Library (not Enzyme)
- Must follow test directory structure from workflow.md (tests/unit/, tests/integration/)
- Must mock all external services (Gemini AI, Recharts)

## Acceptance Criteria

- [ ] `npm run test` executes Vitest and all tests pass
- [ ] `npm run test:coverage` generates coverage report
- [ ] Coverage meets minimum thresholds (60% lines, 50% branches)
- [ ] AdminDashboard has tests for all 7 view modes
- [ ] ManagerDashboard has tests for new hire list rendering
- [ ] NewHireDashboard has tests for module list and progress
- [ ] App.tsx has tests for role-based rendering
- [ ] All mocks are properly isolated and don't affect production code
- [ ] No console errors or warnings during test runs

## Out of Scope

- E2E tests (Playwright/Cypress) — separate track
- Visual regression testing
- Performance testing
- Component refactoring — separate track
- Authentication flow tests — excluded per user request
- Login component tests — excluded per user request

## Dependencies

**New devDependencies to install:**
- `vitest`
- `@vitest/coverage-v8`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `jsdom`
