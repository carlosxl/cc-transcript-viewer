import { apiGet } from './client'
import type { SubagentDetailResponse } from '@/lib/types'

export function getSubagent(
  sessionId: string,
  agentId: string,
  opts?: { signal?: AbortSignal },
): Promise<SubagentDetailResponse> {
  const path = `/api/sessions/${encodeURIComponent(sessionId)}/subagents/${encodeURIComponent(agentId)}`
  return apiGet<SubagentDetailResponse>(path, opts)
}
