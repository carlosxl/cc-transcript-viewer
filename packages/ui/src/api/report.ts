import { apiGet } from './client'
import type { SessionReport } from '@/lib/types'

export function getSessionReport(id: string, opts?: { signal?: AbortSignal }): Promise<SessionReport> {
  return apiGet<SessionReport>(`/api/sessions/${encodeURIComponent(id)}/report`, opts)
}
