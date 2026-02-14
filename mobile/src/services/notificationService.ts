/**
 * Send notification via backend. No UI.
 */

import { api } from '@/api/client';

export interface SendNotificationPayload {
  title?: string;
  body?: string;
}

export const notificationService = {
  async send(payload?: SendNotificationPayload): Promise<{ ok: boolean }> {
    return api.post<{ ok: boolean }>('/notifications/send', payload ?? {});
  },
};
