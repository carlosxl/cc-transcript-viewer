/**
 * Context exposing the currently-viewed session id to deep transcript children.
 *
 * Set once by Transcript.tsx; consumed by leaf components (BlockBashSidecar,
 * file-history backup viewers) that need to fetch session-scoped blobs from
 * the server. Avoids prop-drilling sessionId through 5 layers.
 */
import { createContext, useContext } from 'react'

const TranscriptSessionContext = createContext<string | null>(null)

export const TranscriptSessionProvider = TranscriptSessionContext.Provider

export function useTranscriptSessionId(): string | null {
  return useContext(TranscriptSessionContext)
}
