import { apiGet, apiEventSource } from './client'
import type { SearchResponse, SearchStatusResponse } from '@/lib/types'

export function search(query: string, opts?: { signal?: AbortSignal }): Promise<SearchResponse> {
  const q = encodeURIComponent(query)
  return apiGet<SearchResponse>(`/api/search?q=${q}`, opts)
}

export function getSearchStatus(opts?: { signal?: AbortSignal }): Promise<SearchStatusResponse> {
  return apiGet<SearchStatusResponse>('/api/search/status', opts)
}

/**
 * Subscribe to indexing-progress events. Emits the latest SearchStatusResponse
 * on each `progress` event the server sends.
 */
export function subscribeSearchProgress(
  onEvent: (status: SearchStatusResponse) => void,
  onError?: (e: Event) => void,
): () => void {
  return apiEventSource('/api/search/progress', {
    events: {
      progress: (data) => onEvent(data as SearchStatusResponse),
      status: (data) => onEvent(data as SearchStatusResponse),
    },
    onError,
  })
}
