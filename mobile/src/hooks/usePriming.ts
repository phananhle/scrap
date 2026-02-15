import { useCallback, useState } from 'react';
import { journalService } from '@/services/journalService';
import type { GetPrimingOptions } from '@/services/journalService';

export function usePriming(sinceTimestamp?: number, options?: GetPrimingOptions) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPriming = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await journalService.getPrimingText(sinceTimestamp, options);
      setText(result);
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sinceTimestamp, options?.includeMessages, options?.message, options?.message_contact]);

  return { text, loading, error, fetchPriming };
}
