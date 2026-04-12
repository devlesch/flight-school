-- Track: manager-tasks admin CRUD
-- Add soft delete and RLS policies for manager_task_templates

ALTER TABLE manager_task_templates ADD COLUMN deleted_at TIMESTAMPTZ;

-- Admin CRUD policies
CREATE POLICY "Admins can manage all task templates"
  ON manager_task_templates FOR ALL
  USING (get_user_role() = 'Admin')
  WITH CHECK (get_user_role() = 'Admin');

-- Authenticated users can read (for managers to see templates)
CREATE POLICY "Authenticated users can view task templates"
  ON manager_task_templates FOR SELECT
  USING (auth.role() = 'authenticated');
