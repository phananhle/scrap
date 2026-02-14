/**
 * Journal services. Priming text from API with mock fallback when backend is not ready.
 */

import { api } from '@/api/client';
import type { PrimingResponse } from '@/types/journal';

const MOCK_PRIMING_BULLETS = [
  "• Had coffee with a friend\n• Went for a run in the park\n• Finished a work project\n• Cooked dinner at home",
  "• Caught up on emails\n• Took a long walk\n• Called family\n• Watched a movie",
  "• Met someone new at the gym\n• Tried a new recipe\n• Read for an hour\n• Slept in on Saturday",
];

export const journalService = {
  async getPrimingText(): Promise<string> {
    try {
      const res = await api.get<PrimingResponse>('/journal/priming');
      return res.text;
    } catch {
      const i = Math.floor(Math.random() * MOCK_PRIMING_BULLETS.length);
      return MOCK_PRIMING_BULLETS[i];
    }
  },
};
