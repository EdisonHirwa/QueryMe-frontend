import { useCallback } from 'react';
import { resultApi, type StudentExamResult } from '../api';
import { useAsyncData } from './useAsyncData';

export const useSessionResult = (sessionId?: string) => {
  const loader = useCallback(
    (signal: AbortSignal): Promise<StudentExamResult | null> => {
      if (!sessionId) {
        return Promise.resolve(null);
      }

      return resultApi.getSessionResult(sessionId, signal);
    },
    [sessionId],
  );

  return useAsyncData(loader, [loader], 'Failed to load result details.');
};
