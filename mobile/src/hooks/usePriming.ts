import { useCallback, useState } from 'react';
import { journalService, randomUUID } from '@/services/journalService';
import type { GetPrimingOptions } from '@/services/journalService';

export function usePriming(sinceTimestamp?: number, options?: GetPrimingOptions) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const fetchPriming = useCallback(async () => {
    const start = Date.now();
    const rid = options?.request_id?.trim() || randomUUID();
    setRequestId(rid);
    const params = { sinceTimestamp, ...options, request_id: rid };
    console.log(
      new Date().toISOString(),
      'usePriming',
      'CALL',
      JSON.stringify({ ...params, request_id: '[set]' })
    );

    setLoading(true);
    setError(null);
    try {
      const result = await journalService.getPrimingText(sinceTimestamp, { ...options, request_id: rid });
      const durationMs = Date.now() - start;
      console.log(
        new Date().toISOString(),
        'usePriming',
        'OK',
        durationMs + 'ms',
        `text.length=${result?.text?.length ?? 0}`
      );
      console.log('usePriming backend response:', result?.text ?? (result?.requestId ? '(waiting for paste)' : '(empty)'));
      setText(result.text ?? null);
      setRequestId(result.requestId);
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
      setRequestId(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sinceTimestamp, options?.includeMessages, options?.message, options?.message_contact, options?.request_id]);

  const setPrimingTextFromPaste = useCallback((message: string) => {
    setText(message);
    setRequestId(null);
  }, []);

  return { text, loading, error, fetchPriming, requestId, setPrimingTextFromPaste };
}
