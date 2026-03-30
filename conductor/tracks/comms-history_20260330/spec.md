# Communication Message History Side Panel

## Overview
Log Slack messages sent from Flight School to a database table and display message history in a slide-in side panel when clicking user cards on the communications page. Students show received messages chronologically; managers show sent messages grouped by student.

## Functional Requirements

### FR-1: Slack Messages Database Table
- Create `slack_messages` table with fields: id, sender_id, recipient_id, message_text, channel, sent_at
- `channel` defaults to 'slack' for future extensibility (email, survey)
- RLS: admins see all, users see own sent/received, authenticated users can insert
- Indexes on sender_id and recipient_id

### FR-2: Message Logging After Send
- After successful `sendSlackDM()`, insert a record into `slack_messages`
- Log sender_id (current authenticated user), recipient_id (looked up by email), message_text
- If DB insert fails after successful Slack send, show warning toast but don't block

### FR-3: Message History Service
- `getMessagesForUser(userId)` — fetch messages where recipient_id matches, join with sender profile name
- `getMessagesSentBy(senderId)` — fetch messages where sender_id matches, join with recipient profile name
- Return chronologically sorted results with profile data

### FR-4: Side Panel UI
- Slide-in panel from right (400px wide) on user card click
- Dark teal header with user name, cream body
- Close on outside click, Escape key, or X button
- Disclaimer text: "Showing messages sent from Flight School"

### FR-5: Student View (recipient history)
- Show all messages received, ordered by sent_at DESC
- Each message displays: sender name, formatted timestamp, message text
- Truncate text at 150 chars with "Show more" toggle

### FR-6: Manager View (sender history)
- Show messages sent by this manager, grouped by recipient student
- Order groups by message count DESC (most-messaged student first)
- Each group: student name + avatar, message count, expandable message list

### FR-7: Message Count Badge
- Golden yellow badge on user cards showing total message count
- For students: count of messages received
- For managers: count of messages sent

## Non-Functional Requirements
- Only logs messages sent from Flight School (not Slack API history)
- Lazy-load history on panel open (not on page load)
- Uses existing formatDate utility for timestamps

## Acceptance Criteria
- [ ] Slack messages are logged to DB after successful send
- [ ] Student card click opens panel with received message history
- [ ] Manager card click opens panel with sent messages grouped by student
- [ ] Message count badges visible on user cards
- [ ] Panel closes on outside click and Escape
- [ ] Timestamps display as "March 3rd, 2026"

## Out of Scope
- Slack API message history fetch
- Email/survey message logging
- Real-time updates
- Retroactive history
