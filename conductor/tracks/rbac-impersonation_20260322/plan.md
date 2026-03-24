# Plan: Role-Based Sidebar Filtering & Admin Impersonation

## Phase 1: Impersonation State & Banner

### Epic 1.1: App.tsx State Management
- [x] Task 1.1.1: Write tests for impersonation state in App.tsx
  - [x] Test: `impersonatedProfile` defaults to null, no banner rendered
  - [x] Test: setting `impersonatedProfile` renders ImpersonationBanner
  - [x] Test: `effectiveUser` reflects impersonated profile's role when set
  - [x] Test: exiting impersonation resets view state (currentView, adminViewMode, childTab)
- [x] Task 1.1.2: Implement impersonation state in App.tsx
  - [x] Add `impersonatedProfile` state and `effectiveUser` derived value
  - [x] Add `handleImpersonate(profile)` and `handleExitImpersonation()` handlers
  - [x] Pass `effectiveUser` to Sidebar and renderDashboard instead of `currentUser`
  - [x] Reset view state on impersonation start/exit

### Epic 1.2: ImpersonationBanner Component
- [x] Task 1.2.1: Write tests for ImpersonationBanner
  - [x] Test: renders user name and role
  - [x] Test: displays "UI preview only" disclaimer text
  - [x] Test: Exit button calls `onExit` callback
  - [x] Test: uses brand colors (golden yellow bg, dark teal text)
- [x] Task 1.2.2: Implement ImpersonationBanner component
  - [x] Create `components/ImpersonationBanner.tsx`
  - [x] Golden yellow (`#FDD344`) banner with dark teal (`#013E3F`) text
  - [x] Show "Viewing as [Name] ([Role]) — UI preview only"
  - [x] Exit button with click handler
  - [x] Responsive layout for mobile
- [x] Task 1.2.3: Wire ImpersonationBanner into App.tsx
  - [x] Render banner conditionally when `impersonatedProfile` is not null
  - [x] Position above main content area

- [~] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Impersonation Picker

### Epic 2.1: ImpersonationPicker Component
- [x] Task 2.1.1: Write tests for ImpersonationPicker
  - [x] Test: renders "View as..." button when `isAdmin` is true
  - [x] Test: does NOT render when `isAdmin` is false
  - [x] Test: clicking "View as..." opens dropdown with profile list
  - [x] Test: search input filters profiles by name
  - [x] Test: selecting a profile calls `onSelectUser` callback
  - [x] Test: shows loading state while fetching profiles
  - [x] Test: shows error message with retry on fetch failure
- [x] Task 2.1.2: Implement ImpersonationPicker component
  - [x] Create `components/ImpersonationPicker.tsx`
  - [x] "View as..." button styled to match sidebar footer
  - [x] Dropdown with search input and scrollable profile list
  - [x] Each entry shows avatar, name, and role
  - [x] Lazy fetch via `getAllProfiles()` on first open
  - [x] Cache results for session
  - [x] Loading spinner and error/retry states

### Epic 2.2: Sidebar Integration
- [x] Task 2.2.1: Write tests for Sidebar impersonation integration
  - [x] Test: ImpersonationPicker renders in sidebar footer for admin users
  - [x] Test: ImpersonationPicker hidden for non-admin users
  - [x] Test: ImpersonationPicker hidden during active impersonation
- [x] Task 2.2.2: Integrate ImpersonationPicker into Sidebar
  - [x] Add `isAdmin` and `onImpersonate` props to Sidebar
  - [x] Render ImpersonationPicker in footer section (above user profile)
  - [x] Add `isImpersonating` prop to hide picker during active impersonation
  - [x] Pass props from App.tsx

- [~] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Integration Testing & Polish

### Epic 3.1: End-to-End Flow Testing
- [x] Task 3.1.1: Write integration tests for full impersonation flow
  - [x] Test: admin selects Manager → sidebar shows Manager items only → ManagerDashboard renders
  - [x] Test: admin selects New Hire → sidebar shows My Journey only → NewHireDashboard renders
  - [x] Test: admin clicks Exit → returns to full admin sidebar and AdminDashboard
  - [x] Test: self-impersonation (admin selects themselves) works without error
  - [x] Test: non-admin user never sees impersonation controls

### Epic 3.2: Edge Cases & Polish
- [x] Task 3.2.1: Handle edge cases
  - [x] Verify empty profile list shows appropriate message
  - [x] Verify mobile responsive layout for banner and picker
  - [x] Ensure keyboard accessibility for picker and exit button
- [x] Task 3.2.2: Verify test coverage meets 80% threshold

- [~] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)
