import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

/**
 * Authentication hook that wraps the tRPC auth queries.
 *
 * Returns the current user, loading / error state, a derived
 * `isAuthenticated` flag, and a `logout` helper.
 */
export function useAuth() {
  const {
    data: user = null,
    isLoading: loading,
    error: queryError,
  } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      // Force a full page reload so all cached auth state is cleared
      window.location.href = "/";
    }
  }, [logoutMutation]);

  const error = queryError ?? null;
  const isAuthenticated = !!user && !loading && !error;

  return { user, loading, error, isAuthenticated, logout };
}
