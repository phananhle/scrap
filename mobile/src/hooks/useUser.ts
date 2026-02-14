/**
 * Data hook for current user. Used by screens; no UI.
 */

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@/types/user';
import { userService } from '@/services/userService';

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getCurrentUser();
      setUser(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { user, loading, error, refetch };
}
