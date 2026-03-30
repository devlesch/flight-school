-- Track: comms-history_20260330
-- Create slack_messages table for logging messages sent from Flight School

CREATE TABLE slack_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  message_text TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'slack',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE slack_messages ENABLE ROW LEVEL SECURITY;

-- Admins can view all messages
CREATE POLICY "Admins can view all slack messages"
  ON slack_messages FOR SELECT
  USING (get_user_role() = 'Admin');

-- Users can view their own sent or received messages
CREATE POLICY "Users can view own sent/received messages"
  ON slack_messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Authenticated users can insert messages (sender must be self)
CREATE POLICY "Authenticated users can insert messages"
  ON slack_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_slack_messages_recipient ON slack_messages(recipient_id);
CREATE INDEX idx_slack_messages_sender ON slack_messages(sender_id);
CREATE INDEX idx_slack_messages_sent_at ON slack_messages(sent_at DESC);
