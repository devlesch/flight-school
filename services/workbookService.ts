import { supabase } from '../lib/supabase';
import type { WorkbookResponse } from '../types/database';

/**
 * Get all workbook responses for a user
 */
export async function getWorkbookResponses(userId: string): Promise<WorkbookResponse[]> {
  const { data, error } = await supabase
    .from('workbook_responses')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching workbook responses:', error.message);
    return [];
  }

  return data as WorkbookResponse[];
}

/**
 * Get workbook responses as a map (prompt_key -> response)
 */
export async function getWorkbookResponsesMap(userId: string): Promise<Record<string, string>> {
  const responses = await getWorkbookResponses(userId);
  const map: Record<string, string> = {};

  responses.forEach(r => {
    if (r.response) {
      map[r.prompt_key] = r.response;
    }
  });

  return map;
}

/**
 * Save or update a workbook response
 */
export async function saveWorkbookResponse(
  userId: string,
  promptKey: string,
  response: string
): Promise<WorkbookResponse | null> {
  // Check if exists
  const { data: existing } = await supabase
    .from('workbook_responses')
    .select('id')
    .eq('user_id', userId)
    .eq('prompt_key', promptKey)
    .single();

  const existingRecord = existing as { id: string } | null;

  if (existingRecord) {
    // Update existing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('workbook_responses')
      .update({ response, updated_at: new Date().toISOString() })
      .eq('id', existingRecord.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating workbook response:', error.message);
      return null;
    }

    return data as WorkbookResponse;
  } else {
    // Insert new
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('workbook_responses')
      .insert({
        user_id: userId,
        prompt_key: promptKey,
        response,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating workbook response:', error.message);
      return null;
    }

    return data as WorkbookResponse;
  }
}

/**
 * Add a manager comment to a workbook response
 */
export async function addManagerComment(
  responseId: string,
  comment: string
): Promise<WorkbookResponse | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('workbook_responses')
    .update({ manager_comment: comment, updated_at: new Date().toISOString() })
    .eq('id', responseId)
    .select()
    .single();

  if (error) {
    console.error('Error adding manager comment:', error.message);
    return null;
  }

  return data as WorkbookResponse;
}

/**
 * Get workbook responses with manager comments for a team member
 */
export async function getTeamMemberWorkbook(userId: string): Promise<WorkbookResponse[]> {
  return getWorkbookResponses(userId);
}
