---
track_id: test-coverage_20260131
created: 2026-01-31T10:15:00Z
status: approved
---

# Comprehensive Test Coverage for Core Dashboard Components

## Problem Statement

We are solving **the lack of automated testing** for **developers and future maintainers** because **the project has zero tests despite a workflow requiring 80% coverage and TDD practices, making it risky to add features or refactor code.**

## Success Criteria

- [ ] Vitest configured and running with React Testing Library
- [ ] All 3 dashboard components have basic render tests
- [ ] Role-based rendering tested in App.tsx
- [ ] Module completion logic has unit tests
- [ ] Test coverage reaches minimum 60% (foundation for reaching 80%)
- [ ] CI-ready test script in package.json
- [ ] Zero test warnings or skipped tests in final suite
- [ ] Coverage thresholds configured in Vitest

## Out of Scope

- E2E tests (Playwright/Cypress) — separate track
- Visual regression testing
- Performance testing
- Refactoring large components — separate track
- Authentication flow tests — excluded per user request

## Chosen Approach

**Option A: Vitest + React Testing Library**

Native Vite testing solution with React Testing Library for component tests. Chosen for:
- Zero config with Vite (same build tool)
- Fast HMR and excellent DX
- Jest-compatible API (easy migration if needed)
- Excellent coverage reporting via v8

## Design

### Architecture Overview

```
Testing Stack:
├── Vitest (test runner, coverage)
├── @testing-library/react (component testing)
├── @testing-library/jest-dom (matchers)
├── @testing-library/user-event (interactions)
├── jsdom (DOM environment)
└── MSW (optional: API mocking for geminiService)

Directory Structure (per workflow.md):
tests/
├── unit/
│   ├── components/
│   │   ├── AdminDashboard.test.tsx
│   │   ├── ManagerDashboard.test.tsx
│   │   ├── NewHireDashboard.test.tsx
│   │   └── Login.test.tsx
│   ├── utils/
│   └── types.test.ts
├── integration/
│   ├── role-switching.test.tsx
│   └── module-completion.test.tsx
├── setup.ts (global test setup)
└── mocks/
    ├── geminiService.ts
    └── recharts.tsx
```

### Components

| Component | Test Focus | Priority |
|-----------|------------|----------|
| `App.tsx` | Role switching, login/logout flow, sidebar navigation | High |
| `AdminDashboard.tsx` | View mode switching, data rendering | High |
| `ManagerDashboard.tsx` | New hire list rendering, task tracking | High |
| `NewHireDashboard.tsx` | Module list, progress tracking, OKR display | High |
| `Login.tsx` | Form submission, error display | Medium |

### Data Model

**Test Fixtures** (leverage existing `constants.ts`):
```typescript
// tests/fixtures/users.ts
export { CURRENT_USER_ADMIN, MANAGERS, NEW_HIRES } from '../../constants';

// tests/fixtures/modules.ts
export { MOCK_TRAINING_MODULES, MXM_ONBOARDING_MODULES } from '../../constants';
```

**Mock Interfaces**:
```typescript
// tests/mocks/geminiService.ts
export const mockGeminiService = {
  generateContent: vi.fn().mockResolvedValue({ text: 'Mocked AI response' })
};

// tests/mocks/recharts.tsx
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => children,
  PieChart: () => null,
  Pie: () => null,
  // ... other chart components
}));
```

### User Flow

**Critical Paths to Test:**
1. User logs in → sees correct dashboard for role
2. Admin switches between view modes (dashboard, workflow, cohorts, etc.)
3. Manager views their new hires list
4. New hire sees their training modules and progress
5. Module completion updates progress percentage

### Error Handling

**Error Scenarios to Test:**
- Invalid login credentials → error message displayed
- Empty new hire list → empty state rendered
- Missing module data → graceful fallback
- Network failure on AI service → error boundary or fallback content

### Testing Strategy

| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| Unit | Vitest + RTL | 70% |
| Integration | Vitest + RTL | 50% |
| E2E | (out of scope) | - |

**Coverage Configuration** (vitest.config.ts):
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60
      }
    }
  }
});
```

**Package.json Scripts:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Grounding Notes

- Tech stack verified: Vite 6.2.0, React 18.2.0, TypeScript 5.8.2
- Vitest is the recommended test runner for Vite projects
- Workflow.md specifies test directory structure (unit/, integration/, e2e/)
- Constants.ts contains mock data that can be reused as test fixtures
- Large component sizes (AdminDashboard: 74KB, NewHireDashboard: 92KB) noted for future refactoring track

## Party Panel Insights

- **Winston (Architect):** Use Vitest for seamless Vite integration; separate test and coverage scripts
- **Murat (QA):** Prioritize critical paths; include TypeScript types for jest-dom matchers
- **QA Engineer:** Configure coverage thresholds in Vitest; reuse constants.ts for fixtures
- **Frontend Developer:** Mock Recharts components; test conditional logic not UI details

## Risks & Open Questions

| Risk | Mitigation |
|------|------------|
| Large component files may be hard to test | Focus on public interfaces and user interactions |
| Recharts SVG rendering in jsdom | Mock all Recharts components |
| Gemini AI non-deterministic responses | Mock geminiService entirely |
| Coverage target may be ambitious | Start at 60%, iterate toward 80% |

## Dependencies

**New devDependencies:**
- `vitest`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `@types/testing-library__jest-dom`
- `jsdom`
