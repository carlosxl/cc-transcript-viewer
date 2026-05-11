import { useQuery } from '@tanstack/react-query'
import { fetchSessions } from '../api'

/**
 * GET /api/sessions wrapper. Polls every 10s (D-24 server-side liveness window is 5s;
 * a 10s poll catches edge transitions within ~one cycle).
 * refetchOnWindowFocus is enabled HERE specifically so closing/reopening the laptop
 * refreshes the live indicator immediately.
 */
export function useSessionList() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => (await fetchSessions()).sessions,
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}
