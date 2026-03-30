---
track_id: comms-history_20260330
created: 2026-03-30T00:00:00Z
status: approved
---

# Communication Message History Side Panel

## Problem Statement
We are solving lack of communication audit trail and history for admins and managers because messages sent via Slack from Flight School are fire-and-forget with no record of what was sent, to whom, or when.

## Success Criteria
- [ ] Clicking a user card on communications page opens a side panel with message history
- [ ] For students: shows all messages received (from admins and managers) in chronological order
- [ ] For managers: shows all messages sent to students, grouped by student, ordered by most-messaged
- [ ] Messages are logged to a `slack_messages` DB table after successful send
- [ ] User cards show a message count badge
- [ ] Timestamps formatted as "March 3rd, 2026"

## Out of Scope
- Fetching message history from Slack's API (only log what Flight School sends)
- Email or survey message history (Slack only for now)
- Real-time updates / push notifications
- Two-way messaging (view-only history)
- Retroactive history (only logs from deployment forward)

## Chosen Approach
DB log after successful Slack send + slide-in side panel. Simple, follows existing patterns, no Slack API dependency for reads.

## Design

### Architecture Overview

```
Send Flow (existing + logging):
AdminDashboard → sendSlackDM(email, text) → slack-proxy → Slack
                                          ↓ (on success)
                              insert into slack_messages table

History Flow (new):
Click user card → Side panel slides in → fetch slack_messages → render timeline
```

### Components

1. **Migration: `014_slack_messages.sql`**
   - `slack_messages` table: `id, sender_id, recipient_id, message_text, channel, sent_at`
   - `channel` defaults to 'slack' (extensible for future email/survey)
   - RLS: admins see all, users see own sent/received
   - Indexes on `recipient_id` and `sender_id`

2. **`services/slackService.ts`** — Add logging after send
   - After successful `sendSlackDM`, insert record into `slack_messages`
   - Pass sender user ID (current auth user)

3. **`services/messageHistoryService.ts`** — New service
   - `getMessagesForUser(userId)` — messages where user is recipient, joined with sender profile
   - `getMessagesSentBy(senderId)` — messages sent by a manager, grouped by recipient
   - Returns with sender/recipient profile names

4. **`components/AdminDashboard.tsx`** — Side panel
   - Slide-in panel from right on user card click (400px wide)
   - Student cards: chronological list of received messages
   - Manager cards: grouped by student, ordered by message count desc
   - Each message: sender name, formatDate timestamp, text (truncated at 150 chars with expand)
   - Message count badge (golden yellow) on user cards
   - Close on outside click or Escape
   - Disclaimer: "Showing messages sent from Flight School"

### Data Model

```sql
CREATE TABLE slack_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  message_text TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'slack',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE slack_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all messages"
  ON slack_messages FOR SELECT
  USING (get_user_role() = 'Admin');

CREATE POLICY "Users can view own sent/received messages"
  ON slack_messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Authenticated users can insert messages"
  ON slack_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

CREATE INDEX idx_slack_messages_recipient ON slack_messages(recipient_id);
CREATE INDEX idx_slack_messages_sender ON slack_messages(sender_id);
```

### User Flow

**Student card clicked:**
1. Side panel slides in from right
2. Fetches slack_messages WHERE recipient_id = student.id ORDER BY sent_at DESC
3. Timeline: sender name — formatted date — message preview
4. Click to expand full text

**Manager card clicked:**
1. Side panel slides in
2. Fetches slack_messages WHERE sender_id = manager.id
3. Groups by recipient, counts per student
4. Orders by count DESC
5. Each group: student name, count, expandable message list

### Error Handling

| Scenario | Behavior |
|----------|----------|
| No messages sent | "No messages sent yet" in panel |
| Fetch fails | "Unable to load history" with retry |
| Send succeeds but log fails | Toast warning "Message sent but not logged" |
| Long message text | Truncate at 150 chars with "Show more" |

### Testing Strategy

- Unit: messageHistoryService — mock Supabase queries
- Unit: sendSlackDM logs to DB after success
- Component: Side panel renders message list
- Component: Manager view groups by student and sorts by count

### Aesthetic Direction
- **Panel:** Fixed right, 400px, slide-in animation, dark teal header, cream body
- **Messages:** Card-style, subtle borders, sender avatar + name + formatDate
- **Badge:** Golden yellow circle with count on user cards
- **Colors:** Existing palette — #013E3F, #F3EEE7, #FDD344

## Grounding Notes
- `slackService.ts` — current send function, no logging
- `slack-proxy` Edge Function at `supabase/functions/slack-proxy/index.ts`
- Communications view at AdminDashboard lines ~2122-2171
- `formatDate` utility at `lib/formatDate.ts`
- No existing message storage table

## Party Panel Insights
- Winston: Add `channel` column for future email/survey extensibility
- Murat: Bulk sends should create individual records per recipient
- Frontend Developer: Close on outside click + Escape, React portal
- Reality Checker: Label panel clearly — "messages sent from Flight School" not all Slack history

## Risks & Open Questions
- Only logs future messages — no retroactive history
- Manager RLS: should managers see messages sent by other managers to their students? (current design: no, only own messages)
