import { useCallback, useState } from 'react';
import { journalService } from '@/services/journalService';

export function usePriming(sinceTimestamp?: number) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPriming = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await journalService.getPrimingText(sinceTimestamp);
      setText(result);
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sinceTimestamp]);

  return { text, loading, error, fetchPriming };
}
