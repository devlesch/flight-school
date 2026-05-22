-- ============================================
-- Flight School: Derive role + transitive reporting subtree
-- ============================================
-- Run this in Supabase SQL Editor AFTER 022_admin_manage_manager_tasks.sql
--
-- Repurposes the stored `role` column: `is_admin` becomes the single
-- source of truth for the only genuinely-manual status. "Manager" and
-- new-hire status are now derived from real data (`manager_id`,
-- `cohort_leaders`). `role` is left physically present (blast-radius
-- bound) — a later cleanup migration may DROP it.
--
-- This file is FULLY IDEMPOTENT — it is safe to re-apply. Every
-- statement uses IF NOT EXISTS / CREATE OR REPLACE / DROP-then-CREATE.
-- ============================================

-- ============================================
-- 1. profiles.is_admin column + backfill + index
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Backfill from the stored role string (Admin -> true, everyone else -> false)
UPDATE profiles SET is_admin = (role = 'Admin');

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);

-- ============================================
-- 2. is_admin(uid) — is this profile a stored Admin?
-- ============================================
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = uid), false);
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- ============================================
-- 3. is_manager(uid) — derived: has a direct report OR leads a cohort
-- ============================================
CREATE OR REPLACE FUNCTION is_manager(uid uuid)
RETURNS boolean AS $$
  SELECT
    EXISTS (SELECT 1 FROM profiles WHERE manager_id = uid)
    OR EXISTS (SELECT 1 FROM cohort_leaders WHERE profile_id = uid);
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- ============================================
-- 4. descendant_ids(root) — transitive manager_id subtree below `root`
-- ============================================
-- Cycle-guarded (path-array visited set), depth-capped at 20.
-- Internal authz guard: returns the descendant set ONLY IF the caller
-- is an Admin, OR is `root` itself, OR is an ancestor of `root`
-- (i.e. `root` appears in the caller's own descendant subtree).
-- Otherwise returns no rows (default-deny).
--
-- NOTE: the returned set does NOT include `root` itself — it is the
-- set of STRICT descendants. RLS policies that need the manager's own
-- row must add an explicit `id = auth.uid()` / `user_id = auth.uid()`.
CREATE OR REPLACE FUNCTION descendant_ids(root uuid)
RETURNS SETOF uuid AS $$
  WITH RECURSIVE subtree AS (
    -- Level 0: direct reports of `root`
    SELECT p.id, ARRAY[p.id] AS path, 1 AS depth
    FROM profiles p
    WHERE p.manager_id = root
    UNION ALL
    -- Walk DOWN manager_id; stop on revisit (cycle) or depth cap
    SELECT p.id, s.path || p.id, s.depth + 1
    FROM profiles p
    JOIN subtree s ON p.manager_id = s.id
    WHERE NOT p.id = ANY(s.path)
      AND s.depth < 20
  ),
  -- The caller's OWN subtree, computed once, used purely for the
  -- authz guard. Same cycle/depth guards so it cannot infinite-loop.
  caller_subtree AS (
    SELECT p.id, ARRAY[p.id] AS path, 1 AS depth
    FROM profiles p
    WHERE p.manager_id = auth.uid()
    UNION ALL
    SELECT p.id, cs.path || p.id, cs.depth + 1
    FROM profiles p
    JOIN caller_subtree cs ON p.manager_id = cs.id
    WHERE NOT p.id = ANY(cs.path)
      AND cs.depth < 20
  )
  SELECT subtree.id
  FROM subtree
  WHERE
    is_admin(auth.uid())
    OR root = auth.uid()
    OR root IN (SELECT id FROM caller_subtree);
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- ============================================
-- 5. get_my_role() — derived role for the calling user
-- ============================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text AS $$
  SELECT CASE
    WHEN is_admin(auth.uid()) THEN 'Admin'
    WHEN is_manager(auth.uid()) THEN 'Manager'
    ELSE 'NewHire'
  END;
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- ============================================
-- 6. RLS policy rewrite — replace get_user_role() with derived predicates
-- ============================================
-- get_user_role() is intentionally LEFT DEFINED (001_initial_schema.sql)
-- for back-compat, but is no longer referenced by any policy below.
--
-- RLS-RECURSION SAFETY: every function called from a policy ON `profiles`
-- (is_admin, descendant_ids) is SECURITY DEFINER, so its inner
-- `SELECT ... FROM profiles` bypasses RLS and cannot trigger Postgres
-- error 42P17 (infinite recursion).
--
-- descendant_ids(root) returns STRICT descendants only, so every manager
-- subtree policy also allows the manager's own row explicitly.

-- ---- profiles ----
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Managers can view their team" ON profiles;
CREATE POLICY "Managers can view their team"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (SELECT descendant_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (is_admin(auth.uid()));

-- ---- user_modules ----
DROP POLICY IF EXISTS "Admins can view all progress" ON user_modules;
CREATE POLICY "Admins can view all progress"
  ON user_modules FOR SELECT
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Managers can view team progress" ON user_modules;
CREATE POLICY "Managers can view team progress"
  ON user_modules FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT descendant_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can manage all user modules" ON user_modules;
CREATE POLICY "Admins can manage all user modules"
  ON user_modules FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ---- user_okrs ----
DROP POLICY IF EXISTS "Admins can view all OKR assignments" ON user_okrs;
CREATE POLICY "Admins can view all OKR assignments"
  ON user_okrs FOR SELECT
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage OKR assignments" ON user_okrs;
CREATE POLICY "Admins can manage OKR assignments"
  ON user_okrs FOR ALL
  USING (is_admin(auth.uid()));

-- ---- user_manager_tasks ----
DROP POLICY IF EXISTS "Admins can view all manager tasks" ON user_manager_tasks;
CREATE POLICY "Admins can view all manager tasks"
  ON user_manager_tasks FOR SELECT
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all manager tasks" ON user_manager_tasks;
CREATE POLICY "Admins can manage all manager tasks"
  ON user_manager_tasks FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ---- shoutouts ----
DROP POLICY IF EXISTS "Admins can view all shoutouts" ON shoutouts;
CREATE POLICY "Admins can view all shoutouts"
  ON shoutouts FOR SELECT
  USING (is_admin(auth.uid()));

-- ---- workbook_responses ----
DROP POLICY IF EXISTS "Managers can view team workbook responses" ON workbook_responses;
CREATE POLICY "Managers can view team workbook responses"
  ON workbook_responses FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT descendant_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Managers can comment on team responses" ON workbook_responses;
CREATE POLICY "Managers can comment on team responses"
  ON workbook_responses FOR UPDATE
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT descendant_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can view all workbook responses" ON workbook_responses;
CREATE POLICY "Admins can view all workbook responses"
  ON workbook_responses FOR SELECT
  USING (is_admin(auth.uid()));

-- ---- cohorts ----
DROP POLICY IF EXISTS "Admins can manage cohorts" ON cohorts;
CREATE POLICY "Admins can manage cohorts"
  ON cohorts FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ---- cohort_leaders ----
DROP POLICY IF EXISTS "Admins can manage cohort leaders" ON cohort_leaders;
CREATE POLICY "Admins can manage cohort leaders"
  ON cohort_leaders FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ---- session_logs ----
DROP POLICY IF EXISTS "Admins can read all session logs" ON session_logs;
CREATE POLICY "Admins can read all session logs"
  ON session_logs FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Managers can read team session logs" ON session_logs;
CREATE POLICY "Managers can read team session logs"
  ON session_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT descendant_ids(auth.uid()))
  );

-- ---- manager_task_templates ----
DROP POLICY IF EXISTS "Admins can manage all task templates" ON manager_task_templates;
CREATE POLICY "Admins can manage all task templates"
  ON manager_task_templates FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
