import { supabase } from '../lib/supabase';

export interface MessageRecord {
  id: string;
  senderName: string;
  senderAvatar: string;
  recipientName: string;
  recipientAvatar: string;
  recipientId: string;
  messageText: string;
  sentAt: string;
}

export interface GroupedMessages {
  recipientId: string;
  recipientName: string;
  recipientAvatar: string;
  count: number;
  messages: MessageRecord[];
}

/**
 * Get messages received by a user, with sender profile info.
 */
export async function getMessagesForUser(userId: string): Promise<MessageRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('slack_messages')
    .select('*, sender:profiles!sender_id(name, avatar), recipient:profiles!recipient_id(name, avatar)')
    .eq('recipient_id', userId)
    .order('sent_at', { ascending: false });

  if (error) {
    console.error('Error fetching messages for user:', error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((row: any) => ({
    id: row.id,
    senderName: row.sender?.name || 'Unknown',
    senderAvatar: row.sender?.avatar || '',
    recipientName: row.recipient?.name || 'Unknown',
    recipientAvatar: row.recipient?.avatar || '',
    recipientId: row.recipient_id,
    messageText: row.message_text,
    sentAt: row.sent_at,
  }));
}

/**
 * Get messages sent by a user, with recipient profile info.
 * Returns grouped by recipient, ordered by message count desc.
 */
export async function getMessagesSentBy(senderId: string): Promise<GroupedMessages[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('slack_messages')
    .select('*, sender:profiles!sender_id(name, avatar), recipient:profiles!recipient_id(name, avatar)')
    .eq('sender_id', senderId)
    .order('sent_at', { ascending: false });

  if (error) {
    console.error('Error fetching sent messages:', error.message);
    return [];
  }

  // Group by recipient
  const groups = new Map<string, GroupedMessages>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data || []) as any[]) {
    const recipientId = row.recipient_id;
    if (!groups.has(recipientId)) {
      groups.set(recipientId, {
        recipientId,
        recipientName: row.recipient?.name || 'Unknown',
        recipientAvatar: row.recipient?.avatar || '',
        count: 0,
        messages: [],
      });
    }
    const group = groups.get(recipientId)!;
    group.count++;
    group.messages.push({
      id: row.id,
      senderName: row.sender?.name || 'Unknown',
      senderAvatar: row.sender?.avatar || '',
      recipientName: row.recipient?.name || 'Unknown',
      recipientAvatar: row.recipient?.avatar || '',
      recipientId,
      messageText: row.message_text,
      sentAt: row.sent_at,
    });
  }

  // Sort by count desc
  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

/**
 * Get message counts for multiple users (for badge display).
 * Returns a map of userId → count.
 * For students: count of messages received.
 * For managers: count of messages sent.
 */
export async function getMessageCounts(
  userIds: string[],
  direction: 'received' | 'sent'
): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};

  const column = direction === 'received' ? 'recipient_id' : 'sender_id';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('slack_messages')
    .select('id, ' + column)
    .in(column, userIds);

  if (error) {
    console.error('Error fetching message counts:', error.message);
    return {};
  }

  const counts: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data || []) as any[]) {
    const id = row[column];
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}
