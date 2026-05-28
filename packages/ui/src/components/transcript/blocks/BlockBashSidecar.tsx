/**
 * Renders the structured sidecar for a Bash `tool_result` (T028 + T031).
 *
 * Shows the salient Bash flags (interrupted / sandbox / isImage / exit info)
 * inline. When `persistedOutputPath` is present (server off-loaded the blob),
 * exposes a fetch-on-demand button that pulls the blob via
 * `GET /api/sessions/:id/tool-results/:filename` and renders it inline.
 *
 * On 404 the inline error string is shown as a fallback per FR-013 +
 * spec Edge Case "missing blob".
 */
import { useCallback, useState } from 'react'
import type { BashResult } from '@cc-viewer/shared'
import { ApiError } from '@/api/client'
import { getPersistedToolOutput } from '@/api/sessions'
import { useTranscriptSessionId } from '../TranscriptSessionContext'

interface BlockBashSidecarProps {
  result: BashResult
}

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; text: string }
  | { kind: 'err'; message: string; code: string }

export function BlockBashSidecar({ result }: BlockBashSidecarProps) {
  const sessionId = useTranscriptSessionId()
  const [fetchState, setFetchState] = useState<FetchState>({ kind: 'idle' })

  const persistedPath = result.persistedOutputPath
  const blobFilename = persistedPath ? basename(persistedPath) : null
  const canFetch = sessionId != null && blobFilename != null

  const onFetch = useCallback(async () => {
    if (!sessionId || !blobFilename) return
    setFetchState({ kind: 'loading' })
    try {
      const text = await getPersistedToolOutput(sessionId, blobFilename)
      setFetchState({ kind: 'ok', text })
    } catch (err) {
      if (err instanceof ApiError) {
        setFetchState({ kind: 'err', message: err.message, code: err.code })
      } else {
        setFetchState({ kind: 'err', message: String(err), code: 'fetch_failed' })
      }
    }
  }, [sessionId, blobFilename])

  return (
    <div className="va-tool-sidecar-bash" data-fetch={fetchState.kind}>
      <BashFlagsTable result={result} />

      {result.persistedOutputPath && (
        <div className="va-tool-sidecar-bash-blob">
          <div className="va-tool-sidecar-bash-blob-head">
            <span className="k">off-loaded output</span>
            <span className="path">{result.persistedOutputPath}</span>
          </div>

          {fetchState.kind === 'idle' && canFetch && (
            <button
              type="button"
              className="va-tool-sidecar-bash-blob-fetch"
              onClick={(e) => {
                e.stopPropagation()
                void onFetch()
              }}
            >
              Fetch full output
            </button>
          )}
          {fetchState.kind === 'idle' && !canFetch && (
            <div className="va-tool-sidecar-muted">
              (no session context — cannot fetch)
            </div>
          )}
          {fetchState.kind === 'loading' && (
            <div className="va-tool-sidecar-muted">Loading…</div>
          )}
          {fetchState.kind === 'ok' && (
            <pre className="va-tool-sidecar-text">{fetchState.text}</pre>
          )}
          {fetchState.kind === 'err' && (
            <div className="va-tool-sidecar-bash-blob-err">
              <span className="code">{fetchState.code}</span>
              <span className="msg">{fetchState.message}</span>
              {/* FR-013 fallback: the inline tool_result string we already have
                  is rendered by the standard sidecar/preview path; this card
                  surfaces only the fetch failure itself. */}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BashFlagsTable({ result }: { result: BashResult }) {
  const fields: Array<[string, React.ReactNode]> = []
  if (result.interrupted === true) fields.push(['interrupted', 'true'])
  if (result.isImage === true) fields.push(['isImage', 'true'])
  if (result.sandbox != null) fields.push(['sandbox', String(result.sandbox)])
  if (typeof result.stdout === 'string' && result.stdout.length > 0) {
    fields.push(['stdout', <BashStream key="stdout" text={result.stdout} />])
  }
  if (typeof result.stderr === 'string' && result.stderr.length > 0) {
    fields.push(['stderr', <BashStream key="stderr" text={result.stderr} />])
  }
  if (fields.length === 0) {
    return <div className="va-tool-sidecar-muted">(no flags set)</div>
  }
  return (
    <dl className="va-tool-sidecar-kv">
      {fields.map(([k, v]) => (
        <div key={k} className="va-tool-sidecar-kv-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function BashStream({ text }: { text: string }) {
  // Keep inline preview short; the off-loaded blob path handles full content.
  if (text.length <= 400) return <pre className="va-tool-sidecar-text">{text}</pre>
  return (
    <pre className="va-tool-sidecar-text">
      {text.slice(0, 400)}
      {'\n…'}
    </pre>
  )
}

function basename(p: string): string {
  const slash = p.lastIndexOf('/')
  return slash === -1 ? p : p.slice(slash + 1)
}
