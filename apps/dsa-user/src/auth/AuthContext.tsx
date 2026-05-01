import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { AuthStatusResponse } from '../api/authApi';
import { getAuthStatus } from '../api/authApi';

type AuthContextValue = {
  loading: boolean;
  status: AuthStatusResponse | null;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AuthStatusResponse | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getAuthStatus();
      setStatus(s);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await getAuthStatus();
        if (!cancelled) {
          setStatus(s);
        }
      } catch {
        if (!cancelled) {
          setStatus(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      loading,
      status,
      refresh,
    }),
    [loading, status, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** 与 Provider 同文件的配套 hook，Fast Refresh 需成对保留。 */
// eslint-disable-next-line react-refresh/only-export-components -- useAuth + AuthProvider pair
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
