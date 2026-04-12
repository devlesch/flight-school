-- Fix: Allow admins to manage user_manager_tasks (needed for impersonation)
CREATE POLICY "Admins can manage all manager tasks"
  ON user_manager_tasks FOR ALL
  USING (get_user_role() = 'Admin')
  WITH CHECK (get_user_role() = 'Admin');
