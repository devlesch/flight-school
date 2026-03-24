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
