/**
 * User data retrieval and updates. Uses api client only; no UI.
 */

import { api } from '@/api/client';
import type { User } from '@/types/user';

export const userService = {
  async getCurrentUser(): Promise<User | null> {
    try {
      const user = await api.get<User>('/me');
      return user;
    } catch {
      return null;
    }
  },

  async getProfile(userId: string): Promise<User | null> {
    try {
      const user = await api.get<User>(`/users/${userId}`);
      return user;
    } catch {
      return null;
    }
  },

  async updateProfile(data: Partial<Pick<User, 'name'>>): Promise<User | null> {
    try {
      const user = await api.put<User>('/me', data);
      return user;
    } catch {
      return null;
    }
  },
};
