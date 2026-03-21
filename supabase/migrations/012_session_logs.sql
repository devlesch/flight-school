-- Session logs: one row per sign-in event
CREATE TABLE session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_logs_user_logged_in ON session_logs (user_id, logged_in_at DESC);

ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own rows
CREATE POLICY "Users can insert own session logs"
  ON session_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can read all
CREATE POLICY "Admins can read all session logs"
  ON session_logs FOR SELECT TO authenticated
  USING (get_user_role() = 'Admin');

-- Managers can read their team's logs
CREATE POLICY "Managers can read team session logs"
  ON session_logs FOR SELECT TO authenticated
  USING (
    get_user_role() = 'Manager'
    AND user_id IN (SELECT id FROM profiles WHERE manager_id = auth.uid())
  );

-- Users can read their own logs
CREATE POLICY "Users can read own session logs"
  ON session_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());
