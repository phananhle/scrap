/**
 * Auth state hook. Used by screens; no UI.
 */

import { useEffect, useState } from 'react';
import type { AuthState } from '@/types/user';
import { authService } from '@/services/authService';

export function useAuth() {
  const [state, setState] = useState<AuthState>(authService.getState());

  useEffect(() => {
    const unsubscribe = authService.subscribe(setState);
    return unsubscribe;
  }, []);

  return state;
}
