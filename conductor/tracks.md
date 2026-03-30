# Project Tracks

This file tracks all major tracks for the Industrious Flight School project. Each track has its own detailed plan in its respective folder.

---

## Active Tracks

### [~] Track: Role-Based Sidebar Filtering & Admin Impersonation
*Link: [./conductor/tracks/rbac-impersonation_20260322/](./conductor/tracks/rbac-impersonation_20260322/)*

Add "View as..." impersonation mode for admins to preview role-filtered sidebar and dashboard experiences for any user.

### [~] Track: Wire Manager Dashboard with Real Supabase Data
*Link: [./conductor/tracks/manager-real-data_20260323/](./conductor/tracks/manager-real-data_20260323/)*

Replace mock constants with cohort-based queries: manager → cohort_leaders → cohort → students by date range, real progress, real dates, real reassign modal.

### [~] Track: Upload Task Form — Wire Up & Extend
*Link: [./conductor/tracks/workflow-task-form_20260302/](./conductor/tracks/workflow-task-form_20260302/)*

### [~] Track: Cohort Page — Real Stats Per Leader Slot
*Link: [./conductor/tracks/cohort-real-stats_20260324/](./conductor/tracks/cohort-real-stats_20260324/)*

Replace hardcoded hash-formula stats (Progress, Hires, On Track, At Risk) in cohort leader slots with real data from useAdminDashboard().students.

### [~] Track: Lessonly API Integration + API Key Security Hardening
*Link: [./conductor/tracks/lessonly-integration_20260325/](./conductor/tracks/lessonly-integration_20260325/)*

Integrate Lessonly/Seismic Learning API to auto-track LESSONLY module completion in cohort user cards. Move Gemini API key behind Edge Function proxy for security. Parse lesson IDs from existing module URLs.

### [~] Track: Communication Message History Side Panel
*Link: [./conductor/tracks/comms-history_20260330/](./conductor/tracks/comms-history_20260330/)*

Log Slack messages sent from Flight School to a DB table. Add slide-in side panel on user cards showing message history — chronological for students, grouped by student for managers. Message count badges on cards.

### [ ] Track: Module Audience Targeting (Cohort vs Direct Reports)
*Link: [./conductor/tracks/module-audience_20260330/](./conductor/tracks/module-audience_20260330/)*

Add audience column to training_modules (cohort/direct/null). Task Builder gets audience dropdown. Module filtering respects student's source relationship to manager.

### [x] Track: New Hire Dashboard — Real Data Integration
*Link: [./conductor/tracks/newhire-real-data_20260323/](./conductor/tracks/newhire-real-data_20260323/)*

Replace mock data (MANAGERS, NEW_HIRES arrays) in NewHireDashboard with real Supabase data. Add useLeadershipTeam hook, reuse useProfile for manager lookup, remove mock imports.

---

## Completed Tracks

### [x] Track: Supabase Backend Integration
*Link: [./conductor/archive/supabase-backend_20260131/](./conductor/archive/supabase-backend_20260131/)*

Connect to Supabase for authentication (Google OAuth) and database persistence. Replace mock data with real PostgreSQL backend. Includes 11 database tables, RLS policies, service layer, React hooks, and error handling.

### [x] Track: Add comprehensive test coverage for core dashboard components
*Link: [./conductor/archive/test-coverage_20260131/](./conductor/archive/test-coverage_20260131/)*

### [x] Track: Admin Dashboard — Real Data & AI Analytics
*Link: [./conductor/archive/admin-dashboard-data_20260324/](./conductor/archive/admin-dashboard-data_20260324/)*

Wire Admin Dashboard KPIs (Active Hires, Avg Progress, At Risk) and Gemini AI analytics to real Supabase data. Remove mock data imports from constants.ts.
