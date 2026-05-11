import { QueryClient } from '@tanstack/react-query'

/**
 * Single QueryClient for the SPA.
 *
 * Defaults chosen per Phase 2 research:
 *   - refetchOnWindowFocus: false (Open Question 3 — sessions immutable in Phase 2;
 *     useSessionList opts back IN explicitly via its own queryFn options).
 *   - refetchOnReconnect: false — localhost never disconnects.
 *   - retry: 1 — fast feedback on local API errors; the UI shows a "Try again" button.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
})
