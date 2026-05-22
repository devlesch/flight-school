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
-- NOTE: this migration adds the column + derived functions ONLY.
-- The RLS policy rewrite that consumes them lands in a later task.
-- ============================================

-- ============================================
-- 1. profiles.is_admin column + backfill + index
-- ============================================
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

-- Backfill from the stored role string (Admin -> true, everyone else -> false)
UPDATE profiles SET is_admin = (role = 'Admin');

CREATE INDEX idx_profiles_is_admin ON profiles(is_admin);

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
