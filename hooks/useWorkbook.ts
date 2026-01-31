import { useState, useEffect, useCallback } from 'react';
import type { WorkbookResponse } from '../types/database';
import {
  getWorkbookResponses,
  saveWorkbookResponse,
  addManagerComment,
} from '../services/workbookService';

export interface UseWorkbookReturn {
  responses: WorkbookResponse[];
  responsesMap: Record<string, string>;
  commentsMap: Record<string, string>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  saveResponse: (promptKey: string, response: string) => Promise<void>;
  addComment: (responseId: string, comment: string) => Promise<void>;
}

/**
 * Hook for managing workbook responses
 */
export function useWorkbook(userId: string | undefined): UseWorkbookReturn {
  const [responses, setResponses] = useState<WorkbookResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResponses = useCallback(async () => {
    if (!userId) {
      setResponses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getWorkbookResponses(userId);
      setResponses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workbook');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  // Convert responses to maps for easy access
  const responsesMap: Record<string, string> = {};
  const commentsMap: Record<string, string> = {};

  responses.forEach(r => {
    if (r.response) {
      responsesMap[r.prompt_key] = r.response;
    }
    if (r.manager_comment) {
      commentsMap[r.prompt_key] = r.manager_comment;
    }
  });

  const handleSaveResponse = async (promptKey: string, response: string) => {
    if (!userId) return;

    const result = await saveWorkbookResponse(userId, promptKey, response);
    if (result) {
      setResponses(prev => {
        const existing = prev.find(r => r.prompt_key === promptKey);
        if (existing) {
          return prev.map(r => (r.prompt_key === promptKey ? result : r));
        } else {
          return [...prev, result];
        }
      });
    }
  };

  const handleAddComment = async (responseId: string, comment: string) => {
    const result = await addManagerComment(responseId, comment);
    if (result) {
      setResponses(prev =>
        prev.map(r => (r.id === responseId ? result : r))
      );
    }
  };

  return {
    responses,
    responsesMap,
    commentsMap,
    loading,
    error,
    refetch: fetchResponses,
    saveResponse: handleSaveResponse,
    addComment: handleAddComment,
  };
}
