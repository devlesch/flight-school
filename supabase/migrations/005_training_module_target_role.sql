-- ============================================
-- Flight School: Training Module Target Role + Admin RLS
-- ============================================
-- Run this in Supabase SQL Editor AFTER 004_workday_import_support.sql
-- ============================================

-- ============================================
-- 1. Add target_role column to training_modules
-- NULL means "All Roles" (visible to everyone)
-- ============================================
ALTER TABLE training_modules ADD COLUMN target_role TEXT DEFAULT NULL;

-- ============================================
-- 2. Add admin INSERT/UPDATE/DELETE policy on training_modules
-- Previously only SELECT existed for authenticated users.
-- Admins need full write access to manage the curriculum.
-- ============================================
CREATE POLICY "Admins can manage training modules"
  ON training_modules FOR ALL
  USING (get_user_role() = 'Admin')
  WITH CHECK (get_user_role() = 'Admin');
