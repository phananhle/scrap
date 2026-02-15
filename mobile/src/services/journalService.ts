/**
 * Journal services. Priming text from backend POST /poke/agent (Poke summary).
 * Backend reads the latest reply from Mac Messages (Poke contact) and returns 200 with message.
 * On timeout (504) or 202, paste fallback is available via submitPrimingCallback.
 */

import { api } from '@/api/client';
import type { PokeSendBody, PokeSendResponse } from '@/types/journal';

export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const MOCK_PRIMING_BULLETS = [
  "• Had coffee with a friend\n• Went for a run in the park\n• Finished a work project\n• Cooked dinner at home",
  "• Caught up on emails\n• Took a long walk\n• Called family\n• Watched a movie",
  "• Met someone new at the gym\n• Tried a new recipe\n• Read for an hour\n• Slept in on Saturday",
];

const MAX_HOURS = 24 * 365;
const MIN_HOURS = 1;

/** Tool output strings we treat as non-priming (agent sent via iMessage instead of returning summary) */
const TOOL_OUTPUT_PLACEHOLDERS = [
  'message sent successfully',
  'sms sent successfully',
  'group message sent successfully',
  'sent successfully',
];

/**
 * Normalize backend poke/agent response to a single string for display in the priming text region.
 * Handles JSON (with common keys) or plain text. Filters out tool output (e.g. "Message sent successfully").
 */
function normalizePokeResponse(response: PokeSendResponse): string {
  let text = '';
  let extractedKey = '';
  if (typeof response === 'string') {
    text = response.trim();
    extractedKey = 'string';
  } else if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    const key = ['text', 'message', 'summary', 'content', 'response'].find(
      (k) => typeof obj[k] === 'string'
    );
    extractedKey = key || (typeof obj.body === 'string' ? 'body' : 'none');
    text = key ? (obj[key] as string).trim() : typeof obj.body === 'string' ? obj.body.trim() : JSON.stringify(response);
  } else {
    text = JSON.stringify(response);
    extractedKey = 'json';
  }
  const lower = text.toLowerCase();
  const filteredByPlaceholder = TOOL_OUTPUT_PLACEHOLDERS.some((p) => lower.includes(p) && text.length < 100);
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/e9d32737-a9f8-4386-b060-3a50eaafbf4a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'journalService.ts:normalizePokeResponse',message:'normalize result',data:{extractedKey,textLen:text.length,filteredByPlaceholder,textPreview:text.slice(0,100)},timestamp:Date.now(),hypothesisId:'H2,H4'})}).catch(()=>{});
  // #endregion
  if (filteredByPlaceholder) {
    return '';
  }
  return text;
}

export interface GetPrimingOptions {
  request_id?: string;
  includeMessages?: boolean;
  message?: string;
  message_contact?: string;
}

export interface GetPrimingResult {
  /** Priming text; null when backend returned 202 (waiting for paste) or no usable reply. */
  text: string | null;
  requestId: string;
}

export const journalService = {
  /**
   * Fetch priming text from backend POST /poke/agent.
   * Backend triggers Poke then polls Mac Messages for the latest reply; returns 200 with message.
   * On timeout (504) or 202, returns { text: null, requestId } so UI can show paste fallback.
   */
  async getPrimingText(
    sinceTimestamp?: number,
    options?: GetPrimingOptions
  ): Promise<GetPrimingResult> {
    const requestId = options?.request_id?.trim() || randomUUID();

    try {
      const messageHours =
        sinceTimestamp != null
          ? Math.min(
              MAX_HOURS,
              Math.max(MIN_HOURS, Math.round((Date.now() - sinceTimestamp) / (60 * 60 * 1000)))
            )
          : 168;

      const body: PokeSendBody = {
        request_id: requestId,
        include_messages: options?.includeMessages ?? true,
        message_hours: messageHours,
        ...(options?.message != null && options.message.trim() !== ''
          ? { message: options.message.trim() }
          : {}),
        ...(options?.message_contact != null && options.message_contact.trim() !== ''
          ? { message_contact: options.message_contact.trim() }
          : {}),
      };

      const res = await api.post<PokeSendResponse & { success?: boolean; message?: string; request_id?: string; accepted?: boolean }>('/poke/agent', body);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/e9d32737-a9f8-4386-b060-3a50eaafbf4a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'journalService.ts:getPrimingText:raw',message:'raw API response',data:{resKeys:res&&typeof res==='object'?Object.keys(res):[],resType:typeof res,resPreview:typeof res==='object'&&res?JSON.stringify(res).slice(0,150):String(res).slice(0,150)},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      if (res && typeof res === 'object' && res.success === true && typeof res.message === 'string') {
        const normalized = normalizePokeResponse(res);
        if (normalized && normalized.trim().length > 0) {
          return { text: normalized, requestId };
        }
      }
      if (res && typeof res === 'object' && res.accepted === true && typeof res.request_id === 'string') {
        return { text: null, requestId: res.request_id };
      }
      const normalized = normalizePokeResponse(res);

      if (normalized && normalized.trim().length > 0) {
        return { text: normalized, requestId };
      }
      if (__DEV__) {
        console.warn('[journalService] Backend returned empty, using mock');
      }
      const i = Math.floor(Math.random() * MOCK_PRIMING_BULLETS.length);
      return { text: MOCK_PRIMING_BULLETS[i], requestId };
    } catch (err) {
      if (__DEV__) {
        console.warn('[journalService] Backend request failed, using mock:', err instanceof Error ? err.message : err);
      }
      const i = Math.floor(Math.random() * MOCK_PRIMING_BULLETS.length);
      return { text: MOCK_PRIMING_BULLETS[i], requestId };
    }
  },

  /**
   * Send the agent's reply to the backend to unblock the corresponding POST /poke/agent.
   * Call this when the user has the summary (e.g. pasted from Messages).
   */
  async submitPrimingCallback(requestId: string, message: string): Promise<void> {
    await api.post('/poke/callback', { request_id: requestId, message });
  },

  /**
   * Fetch the latest Scrap recap from backend GET /recap (saved by scrap-mcp when Poke runs Scrap).
   */
  async getRecap(): Promise<{ recap: string; savedAt: string | null } | null> {
    try {
      const res = await api.get<{ ok: boolean; recap?: string; savedAt?: string | null; error?: string }>('/recap');
      if (res && typeof res === 'object' && res.ok === true && typeof res.recap === 'string') {
        return { recap: res.recap, savedAt: res.savedAt ?? null };
      }
      return null;
    } catch {
      return null;
    }
  },
};
