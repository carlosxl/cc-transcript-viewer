import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchSessions } from '../api'

const DEBOUNCE_MS = 200
const MIN_QUERY_LEN = 2

/**
 * Debounce a value (small inline helper to avoid pulling in another dep).
 * The debounced value lags `value` by `delayMs` of stillness — used here so
 * each keystroke doesn't fire a search request.
 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

/**
 * GET /api/search wrapper with input-debounce + a 2-char minimum so single
 * keystrokes don't pelt the server. `placeholderData` keeps the previous
 * results visible while the new query loads — prevents the result list from
 * flashing empty between debounced fetches.
 */
export function useSearchQuery(query: string) {
  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS)
  return useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchSessions(debouncedQuery),
    enabled: debouncedQuery.length >= MIN_QUERY_LEN,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })
}
