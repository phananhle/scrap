import { useCallback, useState } from 'react';
import { journalService } from '@/services/journalService';
import type { GetPrimingOptions } from '@/services/journalService';

/**
 * Priming text for journaling. Fetched from backend GET /summarize, which uses
 * summarize_with_gcal (GCal + Gemini) when Gmail is not requested.
 */
export function usePriming(sinceTimestamp?: number, options?: GetPrimingOptions) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPriming = useCallback(async () => {
    const start = Date.now();
    const params = { sinceTimestamp, ...options };
    console.log(
      new Date().toISOString(),
      'usePriming',
      'CALL',
      JSON.stringify(params)
    );

    setLoading(true);
    setError(null);
    try {
      const result = await journalService.getPrimingText(sinceTimestamp, options);
      const durationMs = Date.now() - start;
      console.log(
        new Date().toISOString(),
        'usePriming',
        'OK',
        durationMs + 'ms',
        `text.length=${result?.length ?? 0}`
      );
      console.log('usePriming backend response:', result ?? '(empty)');
      setText(result);
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      const durationMs = Date.now() - start;
      console.log(
        new Date().toISOString(),
        'usePriming',
        'ERR',
        durationMs + 'ms',
        err.message
      );
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sinceTimestamp, options?.includeGmail]);

  return { text, loading, error, fetchPriming };
}
