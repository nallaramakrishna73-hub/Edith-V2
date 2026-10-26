import { useState, useEffect, useCallback } from 'react';
import { api, ApiClientError } from '../services/api.ts';
import { StatusResponse } from '../types/api.ts';

export function useStatus(pollIntervalMs = 15000) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      // 1. Health check
      await api.getHealth();
      setIsBackendConnected(true);

      // 2. Full status
      const data = await api.getStatus();
      setStatus(data);
      setError(null);
    } catch (err: unknown) {
      setIsBackendConnected(false);
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Backend is unreachable');
      }
      setStatus(prev =>
        prev
          ? {
              ...prev,
              backend: { status: 'disconnected' },
            }
          : null
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchStatus, pollIntervalMs]);

  return {
    status,
    isBackendConnected,
    isLoading,
    error,
    refreshStatus: fetchStatus,
  };
}
