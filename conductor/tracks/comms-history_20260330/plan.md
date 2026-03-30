# Implementation Plan: comms-history_20260330

## Phase 1: Database Migration

- [ ] Task 1.1: Create `supabase/migrations/014_slack_messages.sql`
  - [ ] Create slack_messages table (id, sender_id, recipient_id, message_text, channel, sent_at)
  - [ ] Enable RLS with policies (admin see all, users see own sent/received, insert for authenticated)
  - [ ] Add indexes on sender_id and recipient_id
- [ ] Task 1.2: Add SlackMessage type to `types/database.ts`
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Message Logging

- [ ] Task 2.1: Update `services/slackService.ts` to log messages after send
  - [ ] Look up recipient profile ID by email
  - [ ] Get current authenticated user ID as sender
  - [ ] Insert into slack_messages on successful send
  - [ ] Handle insert failure gracefully (toast warning, don't block)
- [ ] Task 2.2: Write tests for message logging
  - [ ] Test successful send + log
  - [ ] Test send success but log failure (graceful degradation)
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Message History Service

- [ ] Task 3.1: Create `services/messageHistoryService.ts`
  - [ ] `getMessagesForUser(userId)` — fetch received messages with sender profile join
  - [ ] `getMessagesSentBy(senderId)` — fetch sent messages with recipient profile join
  - [ ] `getMessageCounts(userIds)` — batch fetch message counts for badge display
- [ ] Task 3.2: Write tests for messageHistoryService
  - [ ] Test getMessagesForUser returns chronological messages with sender names
  - [ ] Test getMessagesSentBy returns messages with recipient names
  - [ ] Test getMessageCounts returns correct counts per user
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Side Panel + Badges

- [ ] Task 4.1: Add message count badges to communications user cards
  - [ ] Fetch message counts on communications view load
  - [ ] Display golden yellow badge on each user card
- [ ] Task 4.2: Build side panel component in AdminDashboard
  - [ ] Slide-in panel from right (400px, dark teal header, cream body)
  - [ ] Close on outside click, Escape, X button
  - [ ] Student view: chronological message list with sender name, formatDate, truncated text
  - [ ] Manager view: grouped by student, ordered by count DESC, expandable
  - [ ] "Show more" toggle for messages over 150 chars
  - [ ] Disclaimer: "Showing messages sent from Flight School"
  - [ ] Empty state: "No messages sent yet"
- [ ] Task 4.3: Wire panel to user card clicks
  - [ ] On card click: open panel, fetch history via messageHistoryService
  - [ ] Show loading state while fetching
  - [ ] Handle fetch errors with retry button
- [ ] Task 4.4: Write component tests
  - [ ] Test panel opens on card click
  - [ ] Test student view renders chronological messages
  - [ ] Test manager view groups by student
  - [ ] Test empty state
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)
