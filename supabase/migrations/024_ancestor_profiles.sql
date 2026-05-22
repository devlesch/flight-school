-- ============================================
-- Flight School: Reporting-chain ancestor walk
-- ============================================
-- Run AFTER 023_derive_role_and_subtree.sql.
--
-- "Your Leadership" on the New Hire dashboard is a person's REPORTING
-- CHAIN — their direct manager, that manager's manager, up to the top —
-- NOT every leader in their region. This adds the upward companion to
-- 023's downward descendant_ids().
--
-- FULLY IDEMPOTENT — safe to re-apply (CREATE OR REPLACE).
-- ============================================

-- get_ancestor_profiles(uid) — the reporting chain ABOVE `uid`.
-- Walks UP manager_id from `uid` and returns each ancestor profile row,
-- ordered closest-first (direct manager = depth 1).
--
-- Cycle-guarded (path-array visited set), depth-capped at 20.
-- SECURITY DEFINER so a user's OWN session can read their leadership
-- chain even though the one-level profiles RLS would otherwise hide it.
-- Internal authz guard: returns rows ONLY IF the caller is an Admin
-- (covers admin "View-As") OR is `uid` itself. Default-deny otherwise —
-- a user may see who is above them, never an arbitrary person's chain.
CREATE OR REPLACE FUNCTION get_ancestor_profiles(uid uuid)
RETURNS SETOF profiles AS $$
  WITH RECURSIVE chain AS (
    -- Level 1: the direct manager of `uid`
    SELECT m.id, m.manager_id, ARRAY[m.id] AS path, 1 AS depth
    FROM profiles s
    JOIN profiles m ON m.id = s.manager_id
    WHERE s.id = uid
    UNION ALL
    -- Walk UP manager_id; stop on revisit (cycle) or depth cap
    SELECT m.id, m.manager_id, c.path || m.id, c.depth + 1
    FROM chain c
    JOIN profiles m ON m.id = c.manager_id
    WHERE NOT m.id = ANY(c.path)
      AND c.depth < 20
  )
  SELECT p.*
  FROM chain c
  JOIN profiles p ON p.id = c.id
  WHERE is_admin(auth.uid()) OR uid = auth.uid()
  ORDER BY c.depth;
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;
