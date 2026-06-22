-- ============================================
-- Flight School: Invite-only auth + duplicate-account fix
-- ============================================
-- Run this in Supabase SQL Editor AFTER 025_manager_self_tasks.sql
--
-- Fixes two problems:
--   1. Duplicate accounts: an admin-provisioned profile (random UUID) was not
--      merged with the organic profile created on first Google sign-in, because
--      the merge matched email case-sensitively (Workday case vs Google lower-
--      case). This re-keys/merges the duplicates that already exist, then makes
--      the trigger match case-insensitively so it never happens again.
--   2. Open sign-up: the trigger created a 'New Hire' profile for ANY email that
--      authenticated. Now sign-in is invite-only — an admin must have added the
--      email (a provisioned profile) first, or the sign-in is rejected.
-- ============================================

-- ============================================
-- Part A — Merge profiles that already duplicated
-- For each email that has BOTH a provisioned row (admin data, random id) and an
-- organic row (real auth id), keep the organic id (it matches auth.users and is
-- what login looks up), copy the admin data onto it, re-point every FK from the
-- provisioned id to the organic id, then delete the provisioned row.
-- ============================================
DO $$
DECLARE
  rec        RECORD;
  organic_id UUID;
  prov_id    UUID;
BEGIN
  FOR rec IN
    SELECT lower(email) AS em
    FROM public.profiles
    GROUP BY lower(email)
    HAVING count(*) > 1
       AND bool_or(provisioned IS TRUE)
       AND bool_or(provisioned IS NOT TRUE)
  LOOP
    SELECT id INTO organic_id
      FROM public.profiles
      WHERE lower(email) = rec.em AND provisioned IS NOT TRUE
      ORDER BY created_at
      LIMIT 1;

    SELECT id INTO prov_id
      FROM public.profiles
      WHERE lower(email) = rec.em AND provisioned IS TRUE
      ORDER BY created_at
      LIMIT 1;

    IF organic_id IS NULL OR prov_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Re-point every FK reference from the provisioned id to the organic id.
    UPDATE public.user_modules        SET user_id      = organic_id WHERE user_id      = prov_id;
    UPDATE public.user_okrs           SET user_id      = organic_id WHERE user_id      = prov_id;
    UPDATE public.user_manager_tasks  SET manager_id   = organic_id WHERE manager_id   = prov_id;
    UPDATE public.user_manager_tasks  SET new_hire_id  = organic_id WHERE new_hire_id  = prov_id;
    UPDATE public.shoutouts           SET from_user_id = organic_id WHERE from_user_id = prov_id;
    UPDATE public.shoutouts           SET to_user_id   = organic_id WHERE to_user_id   = prov_id;
    UPDATE public.workbook_responses  SET user_id      = organic_id WHERE user_id      = prov_id;
    UPDATE public.module_comments     SET user_id      = organic_id WHERE user_id      = prov_id;
    UPDATE public.cohort_leaders      SET profile_id   = organic_id WHERE profile_id   = prov_id;
    UPDATE public.session_logs        SET user_id      = organic_id WHERE user_id      = prov_id;
    UPDATE public.slack_messages      SET sender_id    = organic_id WHERE sender_id    = prov_id;
    UPDATE public.slack_messages      SET recipient_id = organic_id WHERE recipient_id = prov_id;
    UPDATE public.manager_self_tasks  SET manager_id   = organic_id WHERE manager_id   = prov_id;
    UPDATE public.profiles            SET manager_id   = organic_id WHERE manager_id   = prov_id;

    -- Copy admin-curated data onto the organic row, only filling blanks so any
    -- value the organic profile already has wins.
    UPDATE public.profiles o
    SET
      title             = COALESCE(o.title, p.title),
      location          = COALESCE(o.location, p.location),
      department        = COALESCE(o.department, p.department),
      region            = COALESCE(o.region, p.region),
      start_date        = COALESCE(o.start_date, p.start_date),
      manager_id        = COALESCE(o.manager_id, p.manager_id),
      standardized_role = COALESCE(o.standardized_role, p.standardized_role),
      updated_at        = NOW()
    FROM public.profiles p
    WHERE o.id = organic_id AND p.id = prov_id;

    -- Remove the now-redundant provisioned row.
    DELETE FROM public.profiles WHERE id = prov_id;
  END LOOP;
END $$;

-- ============================================
-- Part B — Invite-only, case-insensitive merge trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_profile_id UUID;
BEGIN
  -- Case-insensitive match against an admin-provisioned profile.
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE lower(email) = lower(NEW.email) AND provisioned = TRUE
  LIMIT 1;

  -- Invite-only: no provisioned profile means the email was never added by an
  -- admin. Reject the sign-in (this rolls back the auth.users insert).
  IF existing_profile_id IS NULL THEN
    RAISE EXCEPTION 'This email has not been added by an administrator. Access denied.';
  END IF;

  -- Cascade the id change to every FK reference.
  UPDATE public.user_modules        SET user_id      = NEW.id WHERE user_id      = existing_profile_id;
  UPDATE public.user_okrs           SET user_id      = NEW.id WHERE user_id      = existing_profile_id;
  UPDATE public.user_manager_tasks  SET manager_id   = NEW.id WHERE manager_id   = existing_profile_id;
  UPDATE public.user_manager_tasks  SET new_hire_id  = NEW.id WHERE new_hire_id  = existing_profile_id;
  UPDATE public.shoutouts           SET from_user_id = NEW.id WHERE from_user_id = existing_profile_id;
  UPDATE public.shoutouts           SET to_user_id   = NEW.id WHERE to_user_id   = existing_profile_id;
  UPDATE public.workbook_responses  SET user_id      = NEW.id WHERE user_id      = existing_profile_id;
  UPDATE public.module_comments     SET user_id      = NEW.id WHERE user_id      = existing_profile_id;
  UPDATE public.cohort_leaders      SET profile_id   = NEW.id WHERE profile_id   = existing_profile_id;
  UPDATE public.session_logs        SET user_id      = NEW.id WHERE user_id      = existing_profile_id;
  UPDATE public.slack_messages      SET sender_id    = NEW.id WHERE sender_id    = existing_profile_id;
  UPDATE public.slack_messages      SET recipient_id = NEW.id WHERE recipient_id = existing_profile_id;
  UPDATE public.manager_self_tasks  SET manager_id   = NEW.id WHERE manager_id   = existing_profile_id;
  UPDATE public.profiles            SET manager_id   = NEW.id WHERE manager_id   = existing_profile_id;

  -- Re-key the provisioned profile to the real auth id and mark it claimed.
  -- Stores the auth (lowercase) email so future lookups stay consistent.
  UPDATE public.profiles
  SET
    id          = NEW.id,
    email       = NEW.email,
    name        = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', name),
    avatar      = COALESCE(NEW.raw_user_meta_data->>'avatar_url', avatar),
    provisioned = FALSE,
    updated_at  = NOW()
  WHERE id = existing_profile_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
