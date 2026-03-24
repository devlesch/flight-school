---
track_id: rbac-impersonation_20260322
created: 2026-03-22
status: approved
---

# Role-Based Sidebar Filtering & Admin Impersonation

## Problem Statement
Admins cannot verify what managers and new hires see in the sidebar and dashboard. Without impersonation, there is no way to preview the role-filtered experience — admins can only trust the code, not see the result.

## Success Criteria
- [ ] Admin can select any user from a dropdown/picker to "view as" that user
- [ ] Sidebar menu items reflect the impersonated user's role (Admin items hidden when viewing as Manager/New Hire)
- [ ] Dashboard renders the appropriate role's dashboard component
- [ ] A prominent banner indicates impersonation is active with the user's name, role, and an exit button
- [ ] Impersonation is strictly admin-only — non-admin users never see the option
- [ ] No data mutations occur during impersonation mode
- [ ] "Exit impersonation" returns the admin to their normal view

## Out of Scope
- Full data context impersonation (fetching the impersonated user's modules, tasks, OKRs) — follow-up track
- Persisting impersonation state across page refreshes via URL params
- Impersonation audit logging

## Chosen Approach
**Option A: Sidebar User Picker + State Override**

Add a "View as..." button near the user profile section in the sidebar footer (admin-only). Clicking it opens a searchable dropdown of all profiles via `getAllProfiles()`. Selecting a user sets `impersonatedProfile` state in App.tsx, which overrides `currentUser` for sidebar rendering and dashboard selection. A golden-yellow banner appears at the top of the main content area.

## Design

### Architecture Overview

```
┌──────────────────────────────────────────────┐
│ App.tsx                                       │
│  ├── realUser (from auth/profile)             │
│  ├── impersonatedProfile (state, null=off)    │
│  ├── effectiveUser = impersonated ?? realUser │
│  └── Renders:                                 │
│      ├── Sidebar(currentUser=effectiveUser)   │
│      ├── ImpersonationBanner (if active)      │
│      └── Dashboard(currentUser=effectiveUser) │
└──────────────────────────────────────────────┘
```

- `realUser` stays untouched (auth context)
- `impersonatedProfile` is a `Profile | null` state
- `effectiveUser` is derived: if impersonating, use impersonated profile converted to User; otherwise use realUser
- Sidebar receives `effectiveUser` → existing role conditionals automatically filter the right menu items
- Dashboard rendering uses `effectiveUser.role` → shows the correct dashboard

### Components

1. **ImpersonationPicker** (new, in Sidebar) — A "View as..." button in the sidebar footer (admin-only) that opens a searchable dropdown of all profiles. Uses `getAllProfiles()`.

2. **ImpersonationBanner** (new, in App.tsx main content) — A fixed banner at the top of the content area showing: "Viewing as [Name] ([Role]) — UI preview only" + "Exit" button. Uses golden yellow (`#FDD344`) background with dark teal (`#013E3F`) text.

3. **Sidebar** (modified) — Receives `effectiveUser` instead of `currentUser`. Also receives `isAdmin` and `onImpersonate` props. Adds the impersonation picker in the footer section (admin-only, hidden during active impersonation).

4. **App.tsx** (modified) — New state: `impersonatedProfile`. Derives `effectiveUser`. Passes it through. Resets view state (adminViewMode, childTab) on impersonation start/exit.

### Data Model

No new database tables. New TypeScript additions:

```typescript
// In App.tsx (local state)
const [impersonatedProfile, setImpersonatedProfile] = useState<Profile | null>(null);

// Derived
const effectiveUser = impersonatedProfile
  ? profileToUser(impersonatedProfile)
  : currentUser;

// ImpersonationPicker props
interface ImpersonationPickerProps {
  onSelectUser: (profile: Profile) => void;
  isAdmin: boolean;
}

// ImpersonationBanner props
interface ImpersonationBannerProps {
  impersonatedUser: User;
  onExit: () => void;
}
```

### User Flow

1. Admin logs in → sees normal admin sidebar with all menu items
2. Admin clicks "View as..." in sidebar footer → searchable dropdown appears with all users
3. Admin selects "Jane Smith (Manager)" →
   - `impersonatedProfile` set to Jane's profile
   - Sidebar re-renders showing only Manager-visible items (Manager Overview + New Hire View)
   - Dashboard switches to ManagerDashboard
   - Golden banner appears: "Viewing as Jane Smith (Manager) — UI preview only" + [Exit]
   - "View as..." picker is hidden (already impersonating)
4. Admin clicks "Exit" on banner →
   - `impersonatedProfile` set to null
   - Sidebar returns to full admin view
   - Dashboard returns to AdminDashboard
   - Banner disappears, picker reappears

### Error Handling

- `getAllProfiles()` fails → show inline error in picker, retry button
- Selected profile is null/undefined → no-op, don't enter impersonation
- Impersonation of self (admin selects themselves) → allowed, shows admin view with banner (useful for verifying the mechanism works)

### Testing Strategy

- Unit tests for ImpersonationBanner: renders name/role, exit button fires callback
- Unit tests for ImpersonationPicker: renders profile list, search filters, selection fires callback
- Integration test: full flow — admin selects user → sidebar updates → dashboard updates → exit returns to admin
- Edge case tests: self-impersonation, empty profile list, mobile responsive

## Grounding Notes

- No existing impersonation code in codebase — clean implementation
- `Sidebar.tsx` role conditionals (lines 29, 100) will work with `effectiveUser` override — zero changes to conditional logic
- `App.tsx` state management patterns match proposed approach
- `getAllProfiles()` exists in `services/teamService.ts` (line 79), used by `hooks/useTeam.ts`
- Brand colors verified: golden yellow `#FDD344`, deep teal `#013E3F`, dark teal `#012d2e`

## Party Panel Insights

- **John (PM):** Impersonation banner must be unmistakable — admins forget they're impersonating and may attempt changes
- **Sally (UX):** Place picker near user profile in sidebar footer for natural discoverability
- **Winston (Architect):** `effectiveUser` pattern is the minimal correct approach — no new contexts or providers needed
- **Reality Checker:** Data hooks will use admin's ID even during impersonation — expected for UI-only preview; banner disclaimer handles this
- **Murat (QA):** Sidebar footer naturally reflects impersonated user via effectiveUser prop; picker hides during impersonation

## Risks & Open Questions

- Data hooks fetch admin's data during impersonation — acceptable for UI preview, but may confuse if not clearly disclaimed
- Follow-up track may be needed for full data-context impersonation if UI-only preview proves insufficient for testing
