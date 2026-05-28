/**
 * Lazy image renderer (007-ui-information-revamp, T027, research R6).
 *
 * Threshold: inline thumbnail for base64 ≤256 KB; placeholder card with metadata
 * + click-to-expand for larger. Click expands either size to a full-size overlay.
 *
 * Sources (three paths per README §10):
 *   1. user.message.content with `type: 'image'`
 *   2. tool_result.content array element with `type: 'image'`
 *   3. BashResult with isImage:true (base64 in stdout)
 */
import { useState } from 'react'

const INLINE_BYTES_THRESHOLD = 256 * 1024 // 256 KB
const THUMB_MAX_EDGE = 240

interface BlockImageProps {
  /** Base64-encoded image data WITHOUT the `data:` prefix. */
  base64: string
  /** MIME type, e.g. 'image/png'. Defaults to 'image/png'. */
  mediaType?: string
  /** Optional source path tag for debugging — not displayed. */
  source?: 'user-paste' | 'tool-result' | 'bash-stdout'
  /** Optional caption shown below the thumbnail. */
  caption?: string
}

export function BlockImage({ base64, mediaType = 'image/png', source, caption }: BlockImageProps) {
  const [expanded, setExpanded] = useState(false)
  // Base64 string length × 3/4 ≈ byte size.
  const sizeBytes = Math.floor((base64.length * 3) / 4)
  const isInline = sizeBytes <= INLINE_BYTES_THRESHOLD
  const dataUri = `data:${mediaType};base64,${base64}`

  if (expanded) {
    return (
      <div className="va-image-overlay" onClick={() => setExpanded(false)}>
        <img src={dataUri} alt={caption ?? ''} className="va-image-full" />
        {caption && <div className="va-image-caption">{caption}</div>}
      </div>
    )
  }

  if (isInline) {
    return (
      <div className="va-image" data-source={source}>
        <img
          src={dataUri}
          alt={caption ?? ''}
          className="va-image-thumb"
          style={{ maxWidth: THUMB_MAX_EDGE, maxHeight: THUMB_MAX_EDGE }}
          onClick={() => setExpanded(true)}
        />
        {caption && <div className="va-image-caption">{caption}</div>}
      </div>
    )
  }

  return (
    <button
      type="button"
      className="va-image-placeholder"
      onClick={() => setExpanded(true)}
      data-source={source}
    >
      <span className="va-image-placeholder-icon">🖼</span>
      <span className="va-image-placeholder-meta">
        {mediaType} · {formatBytes(sizeBytes)} · click to view
      </span>
      {caption && <span className="va-image-caption">{caption}</span>}
    </button>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}
