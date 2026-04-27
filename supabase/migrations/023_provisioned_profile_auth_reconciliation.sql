-- ============================================
-- Flight School: Provisioned profile / auth.users reconciliation
-- ============================================
-- Problem: handle_new_user (mig 004) only fires on auth.users INSERT.
-- If an admin deletes a profile then re-imports it via Workday, the new
-- provisioned profile gets a fresh random UUID, but the user's original
-- auth.users row still exists from a prior login. Result: profiles.id
-- (Y) != auth.users.id (X), and the user can authenticate but can't load
-- their profile.
--
-- This migration:
--   1. Adds an RPC (admin-only) the importer can call to look up
--      auth.users.id by email — so new provisioned profiles can be
--      created with the correct id from the start.
--   2. Reconciles any existing profile/auth-user pairs whose ids don't
--      match — fixes anyone broken by past delete+re-import cycles.
-- ============================================

-- 1. Admin-only RPC: get_auth_user_ids_by_email(emails TEXT[])
-- ============================================
DROP FUNCTION IF EXISTS public.get_auth_user_ids_by_email(TEXT[]);

CREATE OR REPLACE FUNCTION public.get_auth_user_ids_by_email(emails TEXT[])
RETURNS TABLE(email TEXT, id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF public.get_user_role() != 'Admin' THEN
    RAISE EXCEPTION 'Only admins can call get_auth_user_ids_by_email';
  END IF;

  RETURN QUERY
  SELECT au.email::TEXT, au.id
  FROM auth.users au
  WHERE LOWER(au.email) = ANY(SELECT LOWER(unnest(emails)));
END;
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_ids_by_email(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_ids_by_email(TEXT[]) TO authenticated;

-- 2. One-time reconciliation: align any existing profile.id with its
--    auth.users.id when they're mismatched on the same email.
-- ============================================
-- The manager_id self-FK must be dropped during the cascade because
-- updating other profiles' manager_id to r.auth_id would fail
-- (r.auth_id isn't a valid profiles.id until we migrate the target
-- profile's own id, which happens last in the loop). Re-added at the end.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_manager_id_fkey;

DO $$
DECLARE
  r RECORD;
  reconciled_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT au.id AS auth_id, p.id AS profile_id, p.email
    FROM auth.users au
    INNER JOIN public.profiles p ON LOWER(p.email) = LOWER(au.email)
    WHERE au.id != p.id
  LOOP
    -- Cascade FK references first (mirrors mig 004's handle_new_user logic,
    -- extended for tables added later: session_logs, cohort_leaders, slack_messages)
    UPDATE public.user_modules        SET user_id      = r.auth_id WHERE user_id      = r.profile_id;
    UPDATE public.user_okrs           SET user_id      = r.auth_id WHERE user_id      = r.profile_id;
    UPDATE public.user_manager_tasks  SET manager_id   = r.auth_id WHERE manager_id   = r.profile_id;
    UPDATE public.user_manager_tasks  SET new_hire_id  = r.auth_id WHERE new_hire_id  = r.profile_id;
    UPDATE public.shoutouts           SET from_user_id = r.auth_id WHERE from_user_id = r.profile_id;
    UPDATE public.shoutouts           SET to_user_id   = r.auth_id WHERE to_user_id   = r.profile_id;
    UPDATE public.workbook_responses  SET user_id      = r.auth_id WHERE user_id      = r.profile_id;
    UPDATE public.module_comments     SET user_id      = r.auth_id WHERE user_id      = r.profile_id;
    UPDATE public.session_logs        SET user_id      = r.auth_id WHERE user_id      = r.profile_id;
    UPDATE public.cohort_leaders      SET profile_id   = r.auth_id WHERE profile_id   = r.profile_id;
    UPDATE public.slack_messages      SET sender_id    = r.auth_id WHERE sender_id    = r.profile_id;
    UPDATE public.slack_messages      SET recipient_id = r.auth_id WHERE recipient_id = r.profile_id;
    UPDATE public.profiles            SET manager_id   = r.auth_id WHERE manager_id   = r.profile_id;

    -- Now update the profile's own id and clear provisioned flag.
    UPDATE public.profiles
       SET id = r.auth_id,
           provisioned = FALSE,
           updated_at = NOW()
     WHERE id = r.profile_id;

    reconciled_count := reconciled_count + 1;
    RAISE NOTICE 'Reconciled profile for %: % -> %', r.email, r.profile_id, r.auth_id;
  END LOOP;

  RAISE NOTICE 'Total profiles reconciled: %', reconciled_count;
END $$;

-- Restore the manager_id self-FK with the same semantics as migration 018.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_manager_id_fkey
  FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
