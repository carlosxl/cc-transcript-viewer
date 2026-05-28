import { Fragment, type ReactNode } from 'react'

/**
 * Light inline markdown renderer for the design's text blocks (FR-053).
 *
 * Supports **bold**, `code`, and \n line breaks — matching the prototype's
 * transcript.jsx:renderInline. Anything else is rendered verbatim.
 */
const RX = /(\*\*[^*]+\*\*|`[^`]+`|\n)/g

export function renderInline(s: string | null | undefined): ReactNode {
  if (!s) return null
  const parts = s.split(RX)
  const out: ReactNode[] = []
  let i = 0
  for (const part of parts) {
    if (part === '') continue
    if (part === '\n') {
      out.push(<br key={i++} />)
    } else if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      out.push(<strong key={i++}>{part.slice(2, -2)}</strong>)
    } else if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      out.push(<code key={i++}>{part.slice(1, -1)}</code>)
    } else {
      out.push(<Fragment key={i++}>{part}</Fragment>)
    }
  }
  return <>{out}</>
}
