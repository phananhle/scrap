/**
 * Journal services. Priming text from backend GET /summarize (Google Calendar + Gemini),
 * with mock fallback when backend is not ready.
 */

import { api, getAuthToken } from '@/api/client';

const getSummarizeUrl = () => {
  const base = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.example.com';
  return `${base.replace(/\/$/, '')}/summarize`;
};
import type { SummarizeResponse } from '@/types/journal';

const MOCK_PRIMING_BULLETS = [
  "• Had coffee with a friend\n• Went for a run in the park\n• Finished a work project\n• Cooked dinner at home",
  "• Caught up on emails\n• Took a long walk\n• Called family\n• Watched a movie",
  "• Met someone new at the gym\n• Tried a new recipe\n• Read for an hour\n• Slept in on Saturday",
];

const MAX_HOURS = 24 * 365;
const MIN_HOURS = 1;
const DEFAULT_HOURS = 168; // 7 days

export interface GetPrimingOptions {
  /** Include Gmail in the Gemini summary (default true). Requires backend Gmail integration. */
  includeGmail?: boolean;
}

export const journalService = {
  /**
   * Fetch priming text from backend GET /summarize (gcal + gemini).
   * Uses sinceTimestamp to derive hours lookback. Requires Authorization: Bearer <access_token>.
   */
  async getPrimingText(
    sinceTimestamp?: number,
    options?: GetPrimingOptions
  ): Promise<string> {
    if (!getAuthToken()) {
      console.warn('[journalService] No auth token; using mock priming. Sign in to get calendar summary.');
      const i = Math.floor(Math.random() * MOCK_PRIMING_BULLETS.length);
      return MOCK_PRIMING_BULLETS[i];
    }
    try {
      const hours =
        sinceTimestamp != null
          ? Math.min(
              MAX_HOURS,
              Math.max(MIN_HOURS, Math.round((Date.now() - sinceTimestamp) / (60 * 60 * 1000)))
            )
          : DEFAULT_HOURS;

      const summarizeUrl = getSummarizeUrl();
      console.log('[journalService] GET', summarizeUrl, { hours });
      const res = await api.get<SummarizeResponse>('/summarize', {
        params: {
          hours: String(hours),
          includeGmail: options?.includeGmail === false ? 'false' : 'true',
        },
      });

      if (res.ok && typeof res.summary === 'string' && res.summary.trim()) {
        return res.summary.trim();
      }
      if (res.error) {
        throw new Error(res.error);
      }
      throw new Error('Empty summary');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[journalService] GET /summarize failed, using mock:', msg);
      if (msg === 'Network request failed') {
        console.warn('[journalService] Tip: use EXPO_PUBLIC_API_URL=http://YOUR_MAC_IP:3000 (not localhost) when running on device or Android emulator');
      }
      const i = Math.floor(Math.random() * MOCK_PRIMING_BULLETS.length);
      return MOCK_PRIMING_BULLETS[i];
    }
  },
};
