import { useState, useEffect, useCallback } from 'react';
import { api, ApiClientError } from '../services/api.ts';
import { ConversationSummary } from '../types/api.ts';

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getConversations();
      setConversations(data);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load conversations.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteConversation = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      return true;
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to delete conversation.');
      }
      return false;
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    isLoading,
    error,
    refreshConversations: fetchConversations,
    deleteConversation,
  };
}
