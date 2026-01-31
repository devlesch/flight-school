# Learnings: Supabase Backend Integration

**Track:** supabase-backend_20260131
**Completed:** 2026-01-31
**Commits:** 9 (7ffe045..36bcfb5)

---

## Technical Learnings

### 1. Supabase TypeScript Integration

**Pattern:** The Supabase client can be strongly typed using generated database types.

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

**Gotcha:** The `@supabase/supabase-js` types require explicit casting for insert/update operations when using strict TypeScript. We used `as any` casts in services to bypass:
```typescript
const { data, error } = await (supabase as any)
  .from('profiles')
  .update({ name: 'New Name' })
  .eq('id', userId)
  .select()
  .single();
```

### 2. Row Level Security (RLS) Patterns

**Pattern:** Create a helper function for role-based access:
```sql
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

**Pattern:** Manager hierarchy access requires checking `manager_id`:
```sql
CREATE POLICY "managers_view_team" ON profiles
  FOR SELECT USING (
    get_user_role() = 'Manager' AND (
      id = auth.uid() OR
      manager_id = auth.uid()
    )
  );
```

### 3. Auto-Profile Creation on Signup

**Pattern:** Use database trigger to create profile from auth metadata:
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, avatar, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'New Hire'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 4. Domain Restriction for OAuth

**Pattern:** Restrict signups to specific email domain:
```sql
CREATE OR REPLACE FUNCTION check_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email NOT LIKE '%@industriousoffice.com' THEN
    RAISE EXCEPTION 'Only @industriousoffice.com emails allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 5. Hooks Pattern for Data Layer

**Pattern:** Each database entity gets a service + hook pair:
- `services/profileService.ts` - CRUD operations
- `hooks/useProfile.ts` - React state management with loading/error

**Pattern:** Composite hooks combine multiple data sources:
```typescript
// useModules combines training_modules + user_modules
export function useModules(userId) {
  const { modules, loading, markComplete, toggleLike } = ...
}
```

### 6. Graceful Degradation with Mock Data

**Pattern:** Keep mock data as fallback during Supabase transition:
```typescript
const myHires = useMemo(() => {
  if (supabaseTeam.length > 0) {
    return supabaseTeam.map(transformToLegacyFormat);
  }
  return mockHires; // Fallback
}, [supabaseTeam, mockHires]);
```

This allows the app to work during development without Supabase configured.

---

## Architecture Decisions

### AD1: Service Layer Abstraction

**Decision:** All Supabase calls go through service files, not directly in components.

**Rationale:**
- Easier to mock for testing
- Single place to update if Supabase API changes
- Type coercion happens in one place

### AD2: Keep Mock Data During Transition

**Decision:** Don't remove `constants.ts` mock data yet.

**Rationale:**
- Provides fallback when Supabase unavailable
- Allows local development without database
- Tests can continue using mock data

### AD3: Error Boundary + Connection Status

**Decision:** Add global error handling at app level.

**Rationale:**
- Graceful UX when Supabase is down
- Retry mechanism for transient failures
- Clear user feedback

---

## Files Created/Modified

### New Files (18)
- `lib/supabase.ts` - Client initialization
- `types/database.ts` - TypeScript types for all tables
- `services/authService.ts` - Google OAuth
- `services/profileService.ts` - Profile CRUD
- `services/moduleService.ts` - Training modules
- `services/teamService.ts` - Manager team data
- `services/managerTaskService.ts` - Onboarding tasks
- `services/okrService.ts` - OKRs
- `services/workbookService.ts` - Workbook responses
- `services/shoutoutService.ts` - Shoutouts
- `hooks/useAuth.ts` - Auth state
- `hooks/useProfile.ts` - Profile fetching
- `hooks/useModules.ts` - Module progress
- `hooks/useTeam.ts` - Team data
- `hooks/useManagerTasks.ts` - Task management
- `hooks/useOkrs.ts` - OKR fetching
- `hooks/useWorkbook.ts` - Workbook state
- `hooks/useShoutouts.ts` - Shoutouts
- `components/ErrorBoundary.tsx` - Error handling
- `components/ConnectionStatus.tsx` - Offline indicator
- `supabase/migrations/001_initial_schema.sql` - Database schema
- `supabase/migrations/002_auth_trigger.sql` - Auto-profile
- `supabase/migrations/003_restrict_domain.sql` - Domain restriction
- `supabase/seed.sql` - Initial data

### Modified Files (4)
- `App.tsx` - Auth integration, error boundary
- `components/Login.tsx` - Google OAuth button
- `components/NewHireDashboard.tsx` - Supabase hooks
- `components/ManagerDashboard.tsx` - Supabase hooks
- `components/AdminDashboard.tsx` - Supabase hooks

---

## Deployment Notes

To complete the integration, run in Supabase SQL Editor:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_auth_trigger.sql`
3. `supabase/migrations/003_restrict_domain.sql`
4. `supabase/seed.sql`

Configure in Supabase Dashboard:
1. Enable Google OAuth provider
2. Add Google OAuth credentials
3. Set redirect URLs

Environment variables needed:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
