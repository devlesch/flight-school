-- ============================================
-- Flight School: Workday Import Support
-- ============================================
-- Run this in Supabase SQL Editor AFTER 003_restrict_domain.sql
-- ============================================

-- ============================================
-- 1. Drop FK constraint on profiles.id -> auth.users(id)
-- This allows creating profiles with generated UUIDs
-- before users sign up via Google OAuth.
-- ============================================
ALTER TABLE profiles DROP CONSTRAINT profiles_id_fkey;

-- ============================================
-- 2. Add provisioned column
-- Distinguishes Workday-imported profiles from organic signups
-- ============================================
ALTER TABLE profiles ADD COLUMN provisioned BOOLEAN DEFAULT FALSE;

-- ============================================
-- 3. Update auth trigger handle_new_user()
-- When a user signs up via Google OAuth, check if a profile
-- with that email already exists (from Workday import).
-- If so, update the existing profile's id to match auth.users.id
-- and manually cascade the ID change to all FK references.
-- If not, insert a new profile as before.
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_profile_id UUID;
BEGIN
  -- Check if a provisioned profile exists for this email
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = NEW.email AND provisioned = TRUE;

  IF existing_profile_id IS NOT NULL THEN
    -- Manually cascade the ID change to all FK references
    UPDATE public.user_modules SET user_id = NEW.id WHERE user_id = existing_profile_id;
    UPDATE public.user_okrs SET user_id = NEW.id WHERE user_id = existing_profile_id;
    UPDATE public.user_manager_tasks SET manager_id = NEW.id WHERE manager_id = existing_profile_id;
    UPDATE public.user_manager_tasks SET new_hire_id = NEW.id WHERE new_hire_id = existing_profile_id;
    UPDATE public.shoutouts SET from_user_id = NEW.id WHERE from_user_id = existing_profile_id;
    UPDATE public.shoutouts SET to_user_id = NEW.id WHERE to_user_id = existing_profile_id;
    UPDATE public.workbook_responses SET user_id = NEW.id WHERE user_id = existing_profile_id;
    UPDATE public.module_comments SET user_id = NEW.id WHERE user_id = existing_profile_id;
    -- Update manager_id references in other profiles pointing to this one
    UPDATE public.profiles SET manager_id = NEW.id WHERE manager_id = existing_profile_id;

    -- Now update the profile itself
    UPDATE public.profiles
    SET
      id = NEW.id,
      name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', name),
      avatar = COALESCE(NEW.raw_user_meta_data->>'avatar_url', avatar),
      provisioned = FALSE,
      updated_at = NOW()
    WHERE id = existing_profile_id;
  ELSE
    -- No existing profile, insert a new one
    INSERT INTO public.profiles (id, email, name, avatar, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.raw_user_meta_data->>'avatar_url',
      'New Hire'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. Add admin INSERT RLS policy on profiles
-- Allows admins to insert profiles for Workday import
-- ============================================
CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (get_user_role() = 'Admin');
