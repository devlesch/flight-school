import { supabase } from '../lib/supabase';
import type { Shoutout, Profile } from '../types/database';

export interface ShoutoutWithSender extends Shoutout {
  sender?: Profile;
}

/**
 * Get shoutouts received by a user
 */
export async function getShoutoutsForUser(userId: string): Promise<ShoutoutWithSender[]> {
  const { data: shoutouts, error } = await supabase
    .from('shoutouts')
    .select('*')
    .eq('to_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching shoutouts:', error.message);
    return [];
  }

  if (!shoutouts || shoutouts.length === 0) {
    return [];
  }

  // Get sender profiles
  const senderIds = [...new Set((shoutouts as Shoutout[]).map(s => s.from_user_id))];
  const { data: senders, error: sendersError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', senderIds);

  if (sendersError) {
    console.error('Error fetching sender profiles:', sendersError.message);
    return shoutouts as ShoutoutWithSender[];
  }

  const senderMap = new Map((senders || []).map(s => [s.id, s as Profile]));

  return (shoutouts as Shoutout[]).map(shoutout => ({
    ...shoutout,
    sender: senderMap.get(shoutout.from_user_id),
  }));
}

/**
 * Get shoutouts sent by a user
 */
export async function getShoutoutsSentByUser(userId: string): Promise<Shoutout[]> {
  const { data, error } = await supabase
    .from('shoutouts')
    .select('*')
    .eq('from_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching sent shoutouts:', error.message);
    return [];
  }

  return data as Shoutout[];
}

/**
 * Create a new shoutout
 */
export async function createShoutout(
  fromUserId: string,
  toUserId: string,
  message: string
): Promise<Shoutout | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('shoutouts')
    .insert({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      message,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating shoutout:', error.message);
    return null;
  }

  return data as Shoutout;
}
