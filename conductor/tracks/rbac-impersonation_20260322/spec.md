# Spec: Role-Based Sidebar Filtering & Admin Impersonation

## Overview

Add an admin-only "View as..." impersonation mode that allows admins to select any user from the profiles list and preview the app's sidebar menu items and dashboard as that user's role would see them. This is a UI-only preview — no data context changes, no mutations.

## Functional Requirements

### FR-1: Impersonation State Management
- App.tsx adds an `impersonatedProfile` state (`Profile | null`, default `null`)
- When set, a derived `effectiveUser` overrides `currentUser` for all rendering
- `effectiveUser = impersonatedProfile ? profileToUser(impersonatedProfile) : currentUser`
- View state (`currentView`, `adminViewMode`, `childTab`) resets when entering/exiting impersonation
- Setting impersonation to the user's own profile is allowed (for mechanism testing)

### FR-2: Impersonation Picker (Sidebar)
- A "View as..." button appears in the sidebar footer, visible only to Admin users
- Clicking it opens a searchable dropdown listing all profiles from `getAllProfiles()`
- Each entry shows user name, role, and avatar
- Selecting a user triggers `setImpersonatedProfile(profile)`
- The picker is hidden during active impersonation (exit via banner only)
- If `getAllProfiles()` fails, show inline error with retry option

### FR-3: Impersonation Banner
- When impersonation is active, a banner appears at the top of the main content area
- Banner text: "Viewing as [Name] ([Role]) — UI preview only"
- Banner includes an "Exit" button that sets `impersonatedProfile` to `null`
- Banner uses golden yellow (`#FDD344`) background with dark teal (`#013E3F`) text
- Banner must be responsive (mobile-friendly)

### FR-4: Role-Filtered Sidebar
- Sidebar receives `effectiveUser` as `currentUser` prop
- Existing role-based conditional rendering in Sidebar.tsx automatically filters menu items:
  - Admin role → full Admin Console + Manager Overview + New Hire View
  - Manager role → Manager Overview + New Hire View
  - New Hire role → My Journey only
- No changes to Sidebar.tsx conditional logic required — the override propagates naturally

### FR-5: Dashboard Rendering
- `renderDashboard()` in App.tsx uses `effectiveUser.role` to select the dashboard component
- Impersonating a Manager → shows ManagerDashboard
- Impersonating a New Hire → shows NewHireDashboard
- Data hooks will still use the admin's own user ID (UI-only preview)

## Non-Functional Requirements

### NFR-1: Security
- Impersonation is strictly admin-only — the picker must never render for Manager or New Hire roles
- No data mutations during impersonation — this is a read-only visual preview
- Auth context (Supabase session) remains unchanged during impersonation

### NFR-2: Accessibility
- Banner exit button must be keyboard-accessible
- Picker dropdown must support keyboard navigation
- Color contrast must meet WCAG AA standards (golden yellow on dark teal passes)

### NFR-3: Performance
- `getAllProfiles()` fetch should be lazy (only when picker is opened, not on page load)
- Profile list should be cached for the session to avoid repeated fetches

## Acceptance Criteria

- [ ] AC-1: Admin sees "View as..." button in sidebar footer
- [ ] AC-2: Non-admin users do NOT see "View as..." button
- [ ] AC-3: Clicking "View as..." opens a searchable dropdown of all users
- [ ] AC-4: Selecting a Manager user filters sidebar to Manager-only items
- [ ] AC-5: Selecting a New Hire user filters sidebar to New Hire-only items
- [ ] AC-6: Golden yellow banner appears with impersonated user's name and role
- [ ] AC-7: Banner states "UI preview only" disclaimer
- [ ] AC-8: Clicking "Exit" on banner returns to normal admin view
- [ ] AC-9: Dashboard component switches to match impersonated role
- [ ] AC-10: Self-impersonation (admin selects themselves) works without error

## Out of Scope

- Full data context impersonation (fetching impersonated user's modules, tasks, OKRs)
- Persisting impersonation state via URL params across page refreshes
- Impersonation audit logging
- RLS/backend-level impersonation
