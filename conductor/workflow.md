# Development Workflow: Industrious Flight School

## Overview

This document defines the development methodology and standards for the Industrious Flight School project. All contributors should follow these guidelines to ensure consistency and quality.

## Test-Driven Development (TDD)

### Required Coverage
- **Minimum test coverage: 80%**
- All new features must include tests
- Bug fixes should include regression tests

### TDD Cycle
1. **Red** — Write a failing test that defines the expected behavior
2. **Green** — Write the minimum code to make the test pass
3. **Refactor** — Clean up the code while keeping tests green

### Test Structure
```
tests/
├── unit/           # Unit tests for individual functions/components
├── integration/    # Integration tests for feature workflows
└── e2e/           # End-to-end tests (if applicable)
```

## Commit Strategy

### Commit Frequency
- **Commit after every completed task**
- Each commit should represent a single, logical change
- Commits should leave the codebase in a working state

### Commit Message Format
Use conventional commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, no logic change) |
| `refactor` | Code refactoring |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |

**Examples:**
```
feat(dashboard): add progress chart to new hire view
fix(auth): resolve login redirect issue for managers
test(modules): add unit tests for training completion logic
```

### Git Notes
- Use Git Notes for task summaries
- Notes should reference the task ID from the plan
- Format: `Task <id>: <brief summary of work done>`

## Task Workflow

### Task States
| Marker | State | Description |
|--------|-------|-------------|
| `[ ]` | Pending | Task not started |
| `[~]` | In Progress | Currently being worked on |
| `[x]` | Completed | Task finished (include commit SHA) |

### Task Completion Checklist
Before marking a task complete:
1. ✅ All tests pass
2. ✅ Code coverage meets threshold (80%)
3. ✅ Code follows style guides
4. ✅ Changes committed with proper message
5. ✅ Git note added for task summary

## Phase Completion Verification

### Protocol
At the end of each phase in the plan:
1. **Pause** — Do not proceed to next phase automatically
2. **Verify** — Run all tests, check coverage, review changes
3. **Checkpoint** — User manually confirms phase is complete
4. **Document** — Update plan.md with completion status

### Verification Checklist
- [ ] All phase tasks marked `[x]` with commit SHAs
- [ ] Test suite passes
- [ ] Coverage threshold met
- [ ] No linting errors
- [ ] Changes reviewed and approved

## Code Review

### Self-Review Checklist
Before requesting review:
- [ ] Code compiles without warnings
- [ ] Tests added/updated and passing
- [ ] Documentation updated if needed
- [ ] No debug code or console.logs left
- [ ] Follows project style guides

## Branch Strategy

### Branch Naming
```
<type>/<short-description>
```

**Examples:**
- `feat/admin-dashboard-charts`
- `fix/login-redirect-bug`
- `refactor/module-state-management`

### Workflow
1. Create feature branch from `main`
2. Implement changes with atomic commits
3. Open pull request when ready
4. Merge after approval
