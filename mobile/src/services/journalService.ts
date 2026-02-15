/**
 * Journal services. Priming text from backend POST /poke/send (Poke summary),
 * with mock fallback when backend is not ready.
 */

import { api } from '@/api/client';
import type { PokeSendBody, PokeSendResponse } from '@/types/journal';

const MOCK_PRIMING_BULLETS = [
  "• Had coffee with a friend\n• Went for a run in the park\n• Finished a work project\n• Cooked dinner at home",
  "• Caught up on emails\n• Took a long walk\n• Called family\n• Watched a movie",
  "• Met someone new at the gym\n• Tried a new recipe\n• Read for an hour\n• Slept in on Saturday",
];

const MAX_HOURS = 24 * 365;
const MIN_HOURS = 1;

/**
 * Normalize backend poke/send response to a single string for display in the priming text region.
 * Handles JSON (with common keys) or plain text.
 */
function normalizePokeResponse(response: PokeSendResponse): string {
  if (typeof response === 'string') {
    return response.trim();
  }
  if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    const key = ['text', 'message', 'summary', 'content', 'response'].find(
      (k) => typeof obj[k] === 'string'
    );
    if (key) return (obj[key] as string).trim();
    if (typeof obj.body === 'string') return obj.body.trim();
  }
  return JSON.stringify(response);
}

export interface GetPrimingOptions {
  includeMessages?: boolean;
  message?: string;
  message_contact?: string;
}

export const journalService = {
  /**
   * Fetch priming text from backend POST /poke/send.
   * Uses sinceTimestamp to derive message_hours; optional options for message and contact.
   */
  async getPrimingText(
    sinceTimestamp?: number,
    options?: GetPrimingOptions
  ): Promise<string> {
    try {
      const messageHours =
        sinceTimestamp != null
          ? Math.min(
              MAX_HOURS,
              Math.max(MIN_HOURS, Math.round((Date.now() - sinceTimestamp) / (60 * 60 * 1000)))
            )
          : 168;

      const body: PokeSendBody = {
        include_messages: options?.includeMessages ?? true,
        message_hours: messageHours,
        ...(options?.message != null && options.message.trim() !== ''
          ? { message: options.message.trim() }
          : {}),
        ...(options?.message_contact != null && options.message_contact.trim() !== ''
          ? { message_contact: options.message_contact.trim() }
          : {}),
      };

      const res = await api.post<PokeSendResponse>('/poke/send', body);
      return normalizePokeResponse(res);
    } catch {
      const i = Math.floor(Math.random() * MOCK_PRIMING_BULLETS.length);
      return MOCK_PRIMING_BULLETS[i];
    }
  },
};
