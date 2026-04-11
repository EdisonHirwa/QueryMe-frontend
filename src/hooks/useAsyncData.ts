import { useCallback, useEffect, useState } from 'react';
import type { DependencyList, Dispatch, SetStateAction } from 'react';
import { extractErrorMessage } from '../utils/errorUtils';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setData: Dispatch<SetStateAction<T | null>>;
}

export const useAsyncData = <T>(
  loader: (signal: AbortSignal) => Promise<T>,
  dependencies: DependencyList,
  fallbackError?: string,
): AsyncState<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const result = await loader(controller.signal);
      setData(result);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(extractErrorMessage(err, fallbackError));
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [fallbackError, loader]);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    loader(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, fallbackError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refresh, setData };
};
