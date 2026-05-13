import { Sparkles } from 'lucide-react'
import type { Turn } from '@cc-viewer/shared'
import { ContentPreview } from './ContentPreview'

/**
 * Phase 4 redesign — italic body, dashed border, "Thinking" eyebrow.
 *
 * Empty `thinking` text in JSONL is the norm for sessions captured by Claude
 * Code 2.1.69+ on Opus 4.7. Anthropic's API defaults thinking blocks to
 * `display: "omitted"` for Opus 4.7, which strips the visible reasoning text
 * but keeps the encrypted signature; Claude Code does not override this default.
 * Tracking issue: anthropics/claude-code#30958.
 */
export function ThinkingRow({ turn, index }: { turn: Turn; index: number }) {
  const text = turn.thinkingBlocks[index] ?? ''
  const isRedacted = text === ''
  return (
    <div className="px-4 py-1.5" data-thinking-index={index}>
      <div
        className="rounded-md border border-dashed bg-[var(--think-tint)] px-3.5 py-2.5 text-[var(--think-text)]"
      >
        <div className="flex items-center gap-1.5 mb-1 text-[10px] font-sans font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
          <span>Thinking{isRedacted ? ' (redacted)' : ''}</span>
        </div>
        {isRedacted ? (
          <div className="text-xs text-muted-foreground space-y-1 not-italic">
            <p>
              Reasoning text not persisted to disk. Claude Code stored only the
              encrypted signature, not the human-readable summary.
            </p>
            <p>
              To capture summaries in <em>future</em> sessions, add to
              {' '}
              <code className="font-mono">~/.claude/settings.json</code>:
            </p>
            <pre className="font-mono text-[11px] bg-muted p-2 rounded-sm whitespace-pre-wrap break-all">
{`{
  "env": {
    "CLAUDE_CODE_EXTRA_BODY": "{\\"thinking\\":{\\"type\\":\\"adaptive\\",\\"display\\":\\"summarized\\"}}"
  }
}`}
            </pre>
            <p>
              Tracking:
              {' '}
              <a
                href="https://github.com/anthropics/claude-code/issues/30958"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                anthropics/claude-code#30958
              </a>
            </p>
          </div>
        ) : (
          <ContentPreview
            content={text}
            render={(t) => (
              <div className="text-sm italic whitespace-pre-wrap">{t}</div>
            )}
          />
        )}
      </div>
    </div>
  )
}
