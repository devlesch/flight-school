-- ============================================
-- Flight School: Re-link orphaned auth users + FK-safe re-key
-- ============================================
-- Run this in Supabase SQL Editor AFTER 026_invite_only_auth.sql
--
-- Background:
--   026 made the trigger merge an admin-provisioned profile into the real auth
--   account on first sign-in by *mutating the profile's primary key in place*
--   (UPDATE profiles SET id = NEW.id). That mutation is not FK-safe: if anyone
--   references the placeholder id (e.g. a direct report's manager_id), the
--   re-key violates the FK and the whole sign-in transaction rolls back.
--
--   Worse, the trigger only fires on the FIRST auth.users INSERT. Anyone who
--   signed in during the buggy (pre-026) window already has an auth.users row
--   whose id does NOT match their placeholder profile. Signing in again never
--   re-fires the trigger, so the app's getCurrentProfile() (which looks up by
--   auth id) finds nothing and reports the user as nonexistent.
--
-- This migration:
--   Part A — retroactively links every orphaned auth user to its placeholder.
--   Part B — rewrites handle_new_user() to re-key the FK-safe way for the future
--            (insert the real-id row, repoint references, delete the placeholder).
-- ============================================

-- Shared re-key procedure: link a provisioned placeholder profile to a real
-- auth id without ever mutating a primary key in place.
--   1. Temporarily mangle the placeholder email so the new row can't collide on
--      the (case-sensitive) UNIQUE(email) constraint while both rows coexist.
--   2. INSERT the real profile under the auth id, copying the placeholder's data.
--   3. Repoint every FK reference from the placeholder id to the auth id.
--   4. DELETE the placeholder row.
CREATE OR REPLACE FUNCTION public.claim_provisioned_profile(
  auth_id        UUID,
  auth_email     TEXT,
  meta_full_name TEXT,
  meta_name      TEXT,
  meta_avatar    TEXT,
  placeholder_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles SET email = email || '.migrating' WHERE id = placeholder_id;

  INSERT INTO public.profiles (
    id, email, name, avatar, role, title, location, manager_id,
    department, start_date, region, standardized_role, provisioned,
    created_at, updated_at
  )
  SELECT
    auth_id,
    auth_email,
    COALESCE(meta_full_name, meta_name, name),
    COALESCE(meta_avatar, avatar),
    role, title, location, manager_id, department, start_date, region,
    standardized_role, FALSE, created_at, NOW()
  FROM public.profiles WHERE id = placeholder_id;

  UPDATE public.user_modules       SET user_id      = auth_id WHERE user_id      = placeholder_id;
  UPDATE public.user_okrs          SET user_id      = auth_id WHERE user_id      = placeholder_id;
  UPDATE public.user_manager_tasks SET manager_id   = auth_id WHERE manager_id   = placeholder_id;
  UPDATE public.user_manager_tasks SET new_hire_id  = auth_id WHERE new_hire_id  = placeholder_id;
  UPDATE public.shoutouts          SET from_user_id = auth_id WHERE from_user_id = placeholder_id;
  UPDATE public.shoutouts          SET to_user_id   = auth_id WHERE to_user_id   = placeholder_id;
  UPDATE public.workbook_responses SET user_id      = auth_id WHERE user_id      = placeholder_id;
  UPDATE public.module_comments    SET user_id      = auth_id WHERE user_id      = placeholder_id;
  UPDATE public.cohort_leaders     SET profile_id   = auth_id WHERE profile_id   = placeholder_id;
  UPDATE public.session_logs       SET user_id      = auth_id WHERE user_id      = placeholder_id;
  UPDATE public.slack_messages     SET sender_id    = auth_id WHERE sender_id    = placeholder_id;
  UPDATE public.slack_messages     SET recipient_id = auth_id WHERE recipient_id = placeholder_id;
  UPDATE public.manager_self_tasks SET manager_id   = auth_id WHERE manager_id   = placeholder_id;
  UPDATE public.profiles           SET manager_id   = auth_id WHERE manager_id   = placeholder_id;

  DELETE FROM public.profiles WHERE id = placeholder_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Part A — Re-link auth users orphaned during the buggy window
-- ============================================
DO $$
DECLARE
  u              RECORD;
  placeholder_id UUID;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE p.id IS NULL
  LOOP
    SELECT id INTO placeholder_id
    FROM public.profiles
    WHERE lower(email) = lower(u.email) AND provisioned = TRUE
    LIMIT 1;

    -- No placeholder = never provisioned by an admin. Leave as-is; invite-only
    -- would block them anyway. (Surfaces them in the orphan audit query.)
    IF placeholder_id IS NULL THEN
      CONTINUE;
    END IF;

    PERFORM public.claim_provisioned_profile(
      u.id,
      u.email,
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'avatar_url',
      placeholder_id
    );
  END LOOP;
END $$;

-- ============================================
-- Part B — FK-safe invite-only trigger for future sign-ins
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  placeholder_id UUID;
BEGIN
  SELECT id INTO placeholder_id
  FROM public.profiles
  WHERE lower(email) = lower(NEW.email) AND provisioned = TRUE
  LIMIT 1;

  -- Invite-only: no admin-provisioned profile = not allowed.
  IF placeholder_id IS NULL THEN
    RAISE EXCEPTION 'This email has not been added by an administrator. Access denied.';
  END IF;

  PERFORM public.claim_provisioned_profile(
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'avatar_url',
    placeholder_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
