import { apiGet } from './client'
import type { SessionsListResponse, SessionDetailResponse } from '@/lib/types'

export function listSessions(opts?: { signal?: AbortSignal }): Promise<SessionsListResponse> {
  return apiGet<SessionsListResponse>('/api/sessions', opts)
}

export function getSession(id: string, opts?: { signal?: AbortSignal }): Promise<SessionDetailResponse> {
  return apiGet<SessionDetailResponse>(`/api/sessions/${encodeURIComponent(id)}`, opts)
}
