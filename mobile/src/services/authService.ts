/**
 * Auth state and token handling. No UI; persistence can be added later (e.g. SecureStore).
 */

import { setAuthToken } from '@/api/client';
import type { AuthState } from '@/types/user';

let state: AuthState = {
  isAuthenticated: false,
  token: null,
  userId: null,
};

const listeners = new Set<(s: AuthState) => void>();

function notify() {
  listeners.forEach((fn) => fn(state));
}

export const authService = {
  getState(): AuthState {
    return { ...state };
  },

  subscribe(listener: (s: AuthState) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setSession(token: string, userId: string) {
    state = { isAuthenticated: true, token, userId };
    setAuthToken(token);
    notify();
  },

  clearSession() {
    state = { isAuthenticated: false, token: null, userId: null };
    setAuthToken(null);
    notify();
  },
};
