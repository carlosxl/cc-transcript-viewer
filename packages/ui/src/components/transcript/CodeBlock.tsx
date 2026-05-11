// Async syntax-highlight per D-18 + RESEARCH.md Pattern 3. dangerouslySetInnerHTML is safe here
// because Shiki's hast output is fully escaped HTML around the user-supplied raw text —
// no user-supplied HTML reaches this sink directly.
import { useEffect, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { highlight, normalizeLang, type Theme } from '../../lib/highlight'
import { useUIStore } from '../../stores/useUIStore'

const REVERT_MS = 1200   // D-19

export function CodeBlock({ language, code }: { language: string; code: string }) {
  const theme: Theme = useUIStore((s) => (s.theme === 'dark' ? 'vitesse-dark' : 'vitesse-light'))
  const lang = normalizeLang(language)
  const [html, setHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fallbackTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    let alive = true
    highlight(code, lang, theme).then((h) => { if (alive) setHtml(h) })
    return () => { alive = false }
  }, [code, lang, theme])

  async function onCopy() {
    // Per D-19: copy RAW source, never highlighted HTML.
    const raw = code
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(raw)
      } else {
        // Fallback for older browsers (Safari <13.1): hidden textarea + execCommand('copy')
        const ta = document.createElement('textarea')
        ta.value = raw
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.top = '-1000px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
    } catch {
      // Swallow — failed copy is silent per D-19 (no toast).
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), REVERT_MS)
  }

  return (
    <div className="relative group">
      <button
        type="button"
        aria-label={copied ? 'Copied!' : 'Copy code'}
        className="absolute top-2 right-2 w-7 h-7 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={onCopy}
      >
        {copied
          ? <Check className="w-4 h-4 text-green-500" aria-hidden="true" />
          : <Copy  className="w-4 h-4"                aria-hidden="true" />
        }
      </button>
      {html === null
        ? <pre className="bg-muted text-sm p-4" data-testid="codeblock-pre"><code>{code}</code></pre>
        : <div data-testid="codeblock-html" dangerouslySetInnerHTML={{ __html: html }} />}
    </div>
  )
}
