# Specification: Supabase Backend Integration

## Overview

Integrate Supabase as the backend platform for Flight School, replacing hardcoded mock data with a real PostgreSQL database and adding Google OAuth authentication.

## Background

The app currently uses `constants.ts` for all data, making it a static demo. This track transforms it into a multi-user application with persistent data storage.

## Functional Requirements

### FR1: Google OAuth Authentication
- Users sign in via Google OAuth (no email/password)
- Session persists across browser refreshes
- Sign out clears session completely
- New users auto-create a profile on first login (default role: "New Hire")

### FR2: User Profiles
- Profile extends Supabase auth.users with app-specific fields
- Fields: name, role, avatar, title, region, manager_id, department, start_date
- Users can update their own profile (name, avatar)
- Admins can update any profile (including role assignment)

### FR3: Training Module Management
- Training modules stored in database (not hardcoded)
- User progress tracked per module (completed, score, due_date)
- Module completion updates persist immediately
- Support for all module types: WORKBOOK, VIDEO, LIVE_CALL, PERFORM, SHADOW, MANAGER_LED, BAU, LESSONLY, PEER_PARTNER

### FR4: OKR System
- OKRs defined with key results
- Users assigned to OKRs based on role type
- OKR display on New Hire dashboard

### FR5: Manager Onboarding Tasks
- Task templates define standard onboarding checklist
- Tasks instantiated per manager-new hire pair
- Due dates calculated from new hire start date
- Completion tracked and persisted

### FR6: Social Features
- Shoutouts between users (from → to, message)
- Workbook responses saved per user
- Manager comments on workbook responses
- Module comments/likes

### FR7: Role-Based Access Control
- **Admin**: View/edit all users and data
- **Manager**: View own profile + direct reports, edit own data
- **New Hire**: View/edit own data only
- Enforced at database level via RLS policies

## Non-Functional Requirements

### NFR1: Security
- All database access via RLS policies
- No direct SQL exposure to frontend
- API keys stored in environment variables
- HTTPS for all Supabase communication

### NFR2: Performance
- Initial page load < 2 seconds
- Data fetches use appropriate indexes
- Pagination for large data sets (future)

### NFR3: Reliability
- Graceful error handling for network failures
- Loading states for all async operations
- Retry logic for transient errors

### NFR4: Maintainability
- Type-safe database queries (generated types)
- Hooks pattern for data fetching
- Service layer abstraction over Supabase client

## Technical Constraints

- Must use `@supabase/supabase-js` client library
- Must configure Google OAuth in Supabase dashboard
- Must run SQL migrations in Supabase SQL editor
- Environment variables via `.env.local` (Vite)

## Acceptance Criteria

- [ ] AC1: User can sign in with Google and see appropriate dashboard
- [ ] AC2: User can sign out and is redirected to login
- [ ] AC3: New user gets profile auto-created with "New Hire" role
- [ ] AC4: Training module completion persists after page refresh
- [ ] AC5: Manager sees only their direct reports in team view
- [ ] AC6: Admin sees all users across organization
- [ ] AC7: Manager task completion persists in database
- [ ] AC8: App shows loading states during data fetches
- [ ] AC9: App shows error message if Supabase is unreachable
- [ ] AC10: All existing UI functionality works with real data

## Out of Scope

- Email/password authentication
- Real-time subscriptions (Supabase Realtime)
- File storage for avatars (keep URL strings)
- Admin UI for managing training content
- Offline mode / local-first sync

## Dependencies

**New packages:**
- `@supabase/supabase-js` ^2.x

**External:**
- Supabase project with Google OAuth enabled
- Google Cloud Console OAuth credentials
