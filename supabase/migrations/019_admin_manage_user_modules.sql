-- Fix: Allow admins to insert/update user_modules for any user (needed for impersonation)
CREATE POLICY "Admins can manage all user modules"
  ON user_modules FOR ALL
  USING (get_user_role() = 'Admin')
  WITH CHECK (get_user_role() = 'Admin');
