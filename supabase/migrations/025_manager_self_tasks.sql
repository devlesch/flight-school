-- 025_manager_self_tasks.sql
-- Personal ("My Manager Path") onboarding checklist for managers.
-- A manager is themselves a new hire: they get their own instance of the
-- manager_task_templates (authored in the admin "Tasks - Manager" view), dated
-- off their OWN profiles.start_date + template.due_date_offset. This is the
-- manager's personal list and is NOT tied to any new hire or cohort.
--
-- Distinct from user_manager_tasks (which is keyed per new hire). Keeping a
-- separate table leaves that per-hire path 100% untouched and gives a clean
-- two-column unique key for idempotent reconcile-on-load.

CREATE TABLE IF NOT EXISTS manager_self_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id  UUID NOT NULL REFERENCES manager_task_templates(id),
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  due_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manager_self_task UNIQUE (manager_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_manager_self_tasks_manager_id
  ON manager_self_tasks(manager_id);

ALTER TABLE manager_self_tasks ENABLE ROW LEVEL SECURITY;

-- Manager owns their own rows (faithful mirror of the proven user_manager_tasks
-- manager policy in 001: keyed purely on manager_id = auth.uid()).
CREATE POLICY "Managers manage own self tasks"
  ON manager_self_tasks FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- Admins manage all (needed for impersonation). FOR ALL covers SELECT, so no
-- separate admin SELECT policy is required. is_admin(uid) defined in 023.
CREATE POLICY "Admins manage all self tasks"
  ON manager_self_tasks FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- MERGE NOTE: migrations 004/006 re-point user_manager_tasks.manager_id on
-- Workday/profile merges. Any future merge path MUST also re-point this table:
--   UPDATE manager_self_tasks SET manager_id = <surviving_id> WHERE manager_id = <merged_id>;
-- handling the UNIQUE(manager_id, template_id) collision (delete-then-update).
