-- ============================================
-- Flight School: Initial Database Schema
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- EPIC 2.1: Core Tables
-- ============================================

-- Task 2.1.1: Create profiles table
-- Extends Supabase auth.users with app-specific data
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'New Hire' CHECK (role IN ('Admin', 'Manager', 'New Hire')),
  avatar TEXT,
  title TEXT,
  region TEXT,
  manager_id UUID REFERENCES profiles(id),
  department TEXT,
  start_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task 2.1.2: Create training_modules table
-- Training module definitions (content)
CREATE TABLE training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('WORKBOOK', 'VIDEO', 'LIVE_CALL', 'PERFORM', 'SHADOW', 'MANAGER_LED', 'BAU', 'LESSONLY', 'PEER_PARTNER')),
  duration TEXT,
  link TEXT,
  host TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task 2.1.3: Create user_modules junction table
-- User progress on modules
CREATE TABLE user_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  due_date DATE,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  liked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

-- ============================================
-- EPIC 2.2: OKR Tables
-- ============================================

-- Task 2.2.1: Create okrs and key_results tables
CREATE TABLE okrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  role_type TEXT, -- 'MXM', 'GM', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  target TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Task 2.2.2: Create user_okrs junction table
CREATE TABLE user_okrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  UNIQUE(user_id, okr_id)
);

-- ============================================
-- EPIC 2.3: Manager Task Tables
-- ============================================

-- Task 2.3.1: Create manager_task_templates table
CREATE TABLE manager_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_date_offset INTEGER NOT NULL, -- Days relative to start date (negative for prior)
  time_estimate TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Task 2.3.2: Create user_manager_tasks table
CREATE TABLE user_manager_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  new_hire_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES manager_task_templates(id),
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  due_date DATE,
  UNIQUE(manager_id, new_hire_id, template_id)
);

-- ============================================
-- EPIC 2.4: Social Tables
-- ============================================

-- Task 2.4.1: Create shoutouts table
CREATE TABLE shoutouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task 2.4.2: Create workbook_responses table
CREATE TABLE workbook_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prompt_key TEXT NOT NULL,
  response TEXT,
  manager_comment TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, prompt_key)
);

-- Task 2.4.3: Create module_comments table
CREATE TABLE module_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EPIC 2.5: Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE okrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_okrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_manager_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoutouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workbook_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_comments ENABLE ROW LEVEL SECURITY;

-- Task 2.5.1: Create helper function get_user_role()
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Task 2.5.2: Create profiles RLS policies
-- Admin: SELECT all
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (get_user_role() = 'Admin');

-- Manager: SELECT self + team
CREATE POLICY "Managers can view their team"
  ON profiles FOR SELECT
  USING (
    get_user_role() = 'Manager'
    AND (id = auth.uid() OR manager_id = auth.uid())
  );

-- User: SELECT own
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- User: UPDATE own
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin: UPDATE all
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (get_user_role() = 'Admin');

-- INSERT for new users (handled by trigger)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Task 2.5.3: Create user_modules RLS policies
-- Admin: SELECT all
CREATE POLICY "Admins can view all progress"
  ON user_modules FOR SELECT
  USING (get_user_role() = 'Admin');

-- Manager: SELECT team progress
CREATE POLICY "Managers can view team progress"
  ON user_modules FOR SELECT
  USING (
    get_user_role() = 'Manager'
    AND user_id IN (SELECT id FROM profiles WHERE manager_id = auth.uid())
  );

-- User: ALL on own records
CREATE POLICY "Users can manage own modules"
  ON user_modules FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Task 2.5.4: Create public read policies
-- Training modules: SELECT for all authenticated
CREATE POLICY "Anyone can view training modules"
  ON training_modules FOR SELECT
  TO authenticated
  USING (true);

-- OKRs: SELECT for all authenticated
CREATE POLICY "Anyone can view OKRs"
  ON okrs FOR SELECT
  TO authenticated
  USING (true);

-- Key results: SELECT for all authenticated
CREATE POLICY "Anyone can view key results"
  ON key_results FOR SELECT
  TO authenticated
  USING (true);

-- Manager task templates: SELECT for all authenticated
CREATE POLICY "Anyone can view task templates"
  ON manager_task_templates FOR SELECT
  TO authenticated
  USING (true);

-- Task 2.5.5: Create remaining RLS policies

-- user_okrs policies
CREATE POLICY "Users can view own OKR assignments"
  ON user_okrs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all OKR assignments"
  ON user_okrs FOR SELECT
  USING (get_user_role() = 'Admin');

CREATE POLICY "Admins can manage OKR assignments"
  ON user_okrs FOR ALL
  USING (get_user_role() = 'Admin');

-- user_manager_tasks policies
CREATE POLICY "Managers can view their tasks"
  ON user_manager_tasks FOR SELECT
  USING (manager_id = auth.uid());

CREATE POLICY "Managers can manage their tasks"
  ON user_manager_tasks FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

CREATE POLICY "Admins can view all manager tasks"
  ON user_manager_tasks FOR SELECT
  USING (get_user_role() = 'Admin');

CREATE POLICY "New hires can view tasks about them"
  ON user_manager_tasks FOR SELECT
  USING (new_hire_id = auth.uid());

-- shoutouts policies
CREATE POLICY "Users can view shoutouts to them"
  ON shoutouts FOR SELECT
  USING (to_user_id = auth.uid() OR from_user_id = auth.uid());

CREATE POLICY "Admins can view all shoutouts"
  ON shoutouts FOR SELECT
  USING (get_user_role() = 'Admin');

CREATE POLICY "Users can create shoutouts"
  ON shoutouts FOR INSERT
  WITH CHECK (from_user_id = auth.uid());

-- workbook_responses policies
CREATE POLICY "Users can manage own workbook responses"
  ON workbook_responses FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers can view team workbook responses"
  ON workbook_responses FOR SELECT
  USING (
    get_user_role() = 'Manager'
    AND user_id IN (SELECT id FROM profiles WHERE manager_id = auth.uid())
  );

CREATE POLICY "Managers can comment on team responses"
  ON workbook_responses FOR UPDATE
  USING (
    get_user_role() = 'Manager'
    AND user_id IN (SELECT id FROM profiles WHERE manager_id = auth.uid())
  );

CREATE POLICY "Admins can view all workbook responses"
  ON workbook_responses FOR SELECT
  USING (get_user_role() = 'Admin');

-- module_comments policies
CREATE POLICY "Anyone can view module comments"
  ON module_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create module comments"
  ON module_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
  ON module_comments FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_profiles_manager_id ON profiles(manager_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_user_modules_user_id ON user_modules(user_id);
CREATE INDEX idx_user_modules_module_id ON user_modules(module_id);
CREATE INDEX idx_key_results_okr_id ON key_results(okr_id);
CREATE INDEX idx_user_okrs_user_id ON user_okrs(user_id);
CREATE INDEX idx_user_manager_tasks_manager_id ON user_manager_tasks(manager_id);
CREATE INDEX idx_user_manager_tasks_new_hire_id ON user_manager_tasks(new_hire_id);
CREATE INDEX idx_shoutouts_to_user_id ON shoutouts(to_user_id);
CREATE INDEX idx_workbook_responses_user_id ON workbook_responses(user_id);
CREATE INDEX idx_module_comments_module_id ON module_comments(module_id);

-- ============================================
-- Updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to profiles table
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to workbook_responses table
CREATE TRIGGER update_workbook_responses_updated_at
  BEFORE UPDATE ON workbook_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
