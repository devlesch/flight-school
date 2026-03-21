-- ============================================
-- Flight School: Cohorts & Training Leaders
-- ============================================
-- Run this in Supabase SQL Editor AFTER 005_training_module_target_role.sql
-- ============================================

-- ============================================
-- 1. Create cohorts table
-- ============================================
CREATE TABLE public.cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  hire_start_date DATE NOT NULL,
  hire_end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT cohorts_date_range CHECK (hire_end_date >= hire_start_date)
);

-- ============================================
-- 2. Create cohort_leaders table
-- ============================================
CREATE TABLE public.cohort_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  role_label TEXT NOT NULL CHECK (role_label IN ('MxA','MxM','AGM','GM')),
  region TEXT NOT NULL CHECK (region IN ('West','Central','East')),
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cohort_id, role_label, region)
);

-- ============================================
-- 3. Indexes
-- ============================================
CREATE INDEX idx_cohort_leaders_cohort_id ON public.cohort_leaders(cohort_id);
CREATE INDEX idx_cohorts_hire_dates ON public.cohorts(hire_start_date, hire_end_date);

-- ============================================
-- 4. RLS policies
-- ============================================
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_leaders ENABLE ROW LEVEL SECURITY;

-- All authenticated can read
CREATE POLICY "Authenticated users can view cohorts"
  ON public.cohorts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view cohort leaders"
  ON public.cohort_leaders FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admins can manage
CREATE POLICY "Admins can manage cohorts"
  ON public.cohorts FOR ALL
  USING (get_user_role() = 'Admin')
  WITH CHECK (get_user_role() = 'Admin');

CREATE POLICY "Admins can manage cohort leaders"
  ON public.cohort_leaders FOR ALL
  USING (get_user_role() = 'Admin')
  WITH CHECK (get_user_role() = 'Admin');

-- ============================================
-- 5. Update handle_new_user() to cascade cohort_leaders
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
    UPDATE public.cohort_leaders SET profile_id = NEW.id WHERE profile_id = existing_profile_id;
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
