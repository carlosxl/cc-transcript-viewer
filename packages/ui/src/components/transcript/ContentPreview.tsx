import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { COLLAPSE_THRESHOLD } from '@/lib/format'

interface ContentPreviewProps {
  content: string
  render: (text: string) => React.ReactNode
}

/**
 * Per-row "Show full (N lines)" wrapper for long content (D-14 / D-15).
 * useState is intentional and approved (RESEARCH §"Long-content preview wrapper"):
 * resets on virtualization unmount, which matches the desired UX
 * (re-finding a row resets the preview — user must click again).
 */
export function ContentPreview({ content, render }: ContentPreviewProps) {
  const [showFull, setShowFull] = useState(false)
  const lines = content.split('\n')
  const exceedsLines = lines.length > COLLAPSE_THRESHOLD.lines
  const exceedsChars = content.length > COLLAPSE_THRESHOLD.chars
  const needsPreview = exceedsLines || exceedsChars

  if (!needsPreview || showFull) return <>{render(content)}</>

  const previewText = lines.slice(0, COLLAPSE_THRESHOLD.lines).join('\n')
  return (
    <>
      {render(previewText)}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowFull(true)}
        className="mt-2"
      >
        Show full ({lines.length} lines)
      </Button>
    </>
  )
}
