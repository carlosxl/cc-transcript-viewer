import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Attachment, AttachmentRow, SessionTurn, StickyState } from '@/lib/types'
import { isStderrEnvelope } from '@/lib/classifyUserText'
import { fmtK } from '@/lib/format'
import { useFocus } from '@/stores/useFocus'
import { useCompact } from '@/stores/useCompact'
import { useTranscriptSessionId } from './TranscriptSessionContext'
import { useOverlays } from '@/stores/useOverlays'

interface UserPromptProps {
  turn: SessionTurn
  onClick: () => void
}

export function UserPrompt({ turn, onClick }: UserPromptProps) {
  const focusedNodeId = useFocus((s) => s.nodeId)
  const focused = focusedNodeId === turn.userMsgId
  const stderr = isStderrEnvelope(turn.prompt)
  const compact = useCompact((s) => s.compact)
  // Model lives on each Request now (matches the JSONL: model is stored per
  // assistant row). Sticky badges in the user-prompt cap cover the harness-state
  // dimensions only: permission mode, plan/auto flags, worktree.
  const stickyForRender = turn.sticky
  const isCompactSummary = turn.isCompactSummary === true
  return (
    <div
      className={'va-user' + (focused ? ' is-focused' : '') + (isCompactSummary ? ' is-compact-summary' : '')}
      data-focused={focused || undefined}
      data-comment-anchor="user-prompt"
      data-node-id={turn.userMsgId}
      onClick={onClick}
    >
      <div className="va-user-rail" />
      <div className="va-user-body">
        <div className="va-user-cap">
          <span>{isCompactSummary ? 'COMPACTION SUMMARY' : 'YOU'}</span>
          <span className="dot" />
          <span>{turn.time}</span>
          {stderr && !isCompactSummary && (
            <>
              <span className="dot" />
              <span>stderr envelope</span>
            </>
          )}
          {stickyForRender && <StickyBadges sticky={stickyForRender} />}
        </div>
        {isCompactSummary ? (
          <CompactSummary text={turn.prompt} />
        ) : (
          <div className="va-user-text">
            {turn.prompt
              ? <PromptText text={turn.prompt} />
              : <span className="italic" style={{ color: 'var(--text-3)' }}>(empty)</span>}
          </div>
        )}
        {!compact && turn.contextAttachments && turn.contextAttachments.length > 0 && (
          <SessionContext rows={turn.contextAttachments} />
        )}
        {!compact && turn.attachments.length > 0 && <AttachedEvents attachments={turn.attachments} />}
      </div>
    </div>
  )
}

/**
 * The `/compact` synthetic user row carries a multi-KB LLM-generated recap of
 * the pre-compact conversation. Rendering it inline would dwarf every real
 * prompt, so we collapse it to a one-line summary by default and let the
 * reader expand on demand. The first non-blank line usually carries a useful
 * "Primary Request" phrase that hints at what was compacted.
 */
function CompactSummary({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const firstLine = (text.split('\n').find((l) => l.trim().length > 0) ?? '').slice(0, 140)
  const charCount = text.length
  return (
    <div className="va-compact-summary">
      <button
        type="button"
        className="va-compact-summary-head"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <span className="k">{open ? '−' : '+'}</span>
        <span className="va-compact-summary-hint">
          {open ? 'Hide summary' : 'Show summary'}
        </span>
        <span className="va-compact-summary-meta">
          (auto-generated, ~{Math.round(charCount / 1000)}k chars)
        </span>
      </button>
      {!open && firstLine && (
        <div className="va-compact-summary-preview">{firstLine}…</div>
      )}
      {open && (
        <pre className="va-compact-summary-body" onClick={(e) => e.stopPropagation()}>
          {text}
        </pre>
      )}
    </div>
  )
}

/**
 * Render the harness-injected context attachments (`deferred_tools_delta`,
 * `skill_listing`) the LLM received with this prompt. One collapsible
 * disclosure per row so a turn with multiple tool/skill updates shows them all
 * stacked rather than blending into a single wall of text.
 */
function SessionContext({ rows }: { rows: AttachmentRow[] }) {
  return (
    <div className="va-context-group">
      {rows.map((r) => (
        <SessionContextItem key={r.uuid} row={r} />
      ))}
    </div>
  )
}

function SessionContextItem({ row }: { row: AttachmentRow }) {
  const [open, setOpen] = useState(false)
  const a = row.attachment as { type: string } & Record<string, unknown>
  if (a.type === 'deferred_tools_delta') {
    const added = Array.isArray(a.addedNames) ? (a.addedNames as string[]) : []
    const removed = Array.isArray(a.removedNames) ? (a.removedNames as string[]) : []
    const readded = Array.isArray(a.readdedNames) ? (a.readdedNames as string[]) : []
    const label =
      added.length === 0 && removed.length === 0 && readded.length === 0
        ? 'tools delta (empty)'
        : `tools delta · +${added.length}${removed.length ? ` · −${removed.length}` : ''}${readded.length ? ` · ↺${readded.length}` : ''}`
    return (
      <div className="va-context-item">
        <button
          type="button"
          className="va-context-head"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
        >
          <span className="k">{open ? '−' : '+'}</span>
          <span>{label}</span>
        </button>
        {open && (
          <div className="va-context-body" onClick={(e) => e.stopPropagation()}>
            {added.length > 0 && <div className="va-delta-add">+ {added.join(', ')}</div>}
            {readded.length > 0 && <div className="va-delta-readd">↺ {readded.join(', ')}</div>}
            {removed.length > 0 && <div className="va-delta-del">− {removed.join(', ')}</div>}
          </div>
        )}
      </div>
    )
  }
  if (a.type === 'skill_listing') {
    const skillCount = typeof a.skillCount === 'number' ? a.skillCount : undefined
    const isInitial = a.isInitial === true
    const content = typeof a.content === 'string' ? a.content : ''
    const label = `${skillCount ?? '?'} skills${isInitial ? ' · initial' : ' · update'}`
    return (
      <div className="va-context-item">
        <button
          type="button"
          className="va-context-head"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
        >
          <span className="k">{open ? '−' : '+'}</span>
          <span>{label}</span>
        </button>
        {open && (
          <pre className="va-context-body va-context-pre" onClick={(e) => e.stopPropagation()}>
            {content}
          </pre>
        )}
      </div>
    )
  }
  return null
}

function AttachedEvents({ attachments }: { attachments: Attachment[] }) {
  const [open, setOpen] = useState(false)
  const tokenTotal = attachments.reduce((s, a) => s + a.tokens, 0)
  const errorCount = attachments.reduce((s, a) => s + (a.isError ? 1 : 0), 0)
  return (
    <div className="va-user-attach-group">
      <button
        type="button"
        className="va-user-attach"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <span className="k">{open ? '−' : '+'}</span>
        <span>{attachments.length} attached events</span>
        <span className="k">·</span>
        <span>~{fmtK(tokenTotal)} tokens</span>
        {errorCount > 0 && (
          <>
            <span className="k">·</span>
            <span className="va-user-attach-err">{errorCount} error{errorCount === 1 ? '' : 's'}</span>
          </>
        )}
      </button>
      {open && (
        <ul className="va-user-attach-list" onClick={(e) => e.stopPropagation()}>
          {attachments.map((a, i) => (
            <AttachmentItem key={a.toolUseId ?? `${a.kind}-${i}`} attachment={a} />
          ))}
        </ul>
      )}
    </div>
  )
}

function AttachmentItem({ attachment }: { attachment: Attachment }) {
  const body = attachment.body ?? attachment.desc
  const hasIntent = Boolean(attachment.toolName)
  return (
    <li className={'va-attach-item' + (attachment.isError ? ' is-error' : '')}>
      <div className="va-attach-head">
        {hasIntent ? (
          <>
            <span className="va-attach-tool">{attachment.toolName}</span>
            {attachment.toolArgs && (
              <span className="va-attach-args" title={attachment.toolArgs}>
                {attachment.toolArgs}
              </span>
            )}
          </>
        ) : (
          <span className="va-attach-kind">{attachment.kind}</span>
        )}
        {attachment.toolUseId && (
          <>
            <span className="dot" />
            <span className="va-attach-tuid" title={attachment.toolUseId}>
              {attachment.toolUseId.slice(-8)}
            </span>
          </>
        )}
        {attachment.tokens > 0 && (
          <>
            <span className="dot" />
            <span>~{fmtK(attachment.tokens)} tok</span>
          </>
        )}
        {attachment.isError && (
          <>
            <span className="dot" />
            <span className="va-attach-err">error</span>
          </>
        )}
      </div>
      {body && <pre className="va-attach-body">{body}</pre>}
    </li>
  )
}

/**
 * Detect the Claude Code slash-command envelope. The JSONL prompt for a
 * `/clear` or `/model opus` line is stored as three tags — `<command-name>`,
 * `<command-message>`, `<command-args>` — in any order. Returns the parsed
 * parts when the whole prompt is this envelope (and nothing else), else null.
 */
function tryParseSlashCommand(text: string): { name: string; args: string } | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('<command-')) return null
  const nameMatch = trimmed.match(/<command-name>([\s\S]*?)<\/command-name>/)
  if (!nameMatch) return null
  const argsMatch = trimmed.match(/<command-args>([\s\S]*?)<\/command-args>/)
  // Strip the three known tags; whatever remains must be whitespace for this
  // to count as a "pure" command envelope (vs. command + extra user text).
  const stripped = trimmed
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, '')
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, '')
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, '')
    .trim()
  if (stripped.length > 0) return null
  return { name: nameMatch[1].trim(), args: (argsMatch?.[1] ?? '').trim() }
}

/**
 * Render a user-prompt body. Handles two special cases:
 *  - Slash-command envelopes (`<command-name>/clear</command-name>...`) render
 *    as a clean inline command chip like the CC terminal shows them.
 *  - `[Image #N]` placeholders become clickable chips that open the image-cache
 *    file at `/api/sessions/<id>/images/<N>` in the lightbox overlay.
 */
function PromptText({ text }: { text: string }) {
  const sessionId = useTranscriptSessionId()
  const openImage = useOverlays((s) => s.openImage)

  const cmd = tryParseSlashCommand(text)
  if (cmd) {
    return (
      <span className="va-slash-cmd">
        <span className="va-slash-cmd-name">{cmd.name}</span>
        {cmd.args && <span className="va-slash-cmd-args">{cmd.args}</span>}
      </span>
    )
  }

  // Replace `[Image #N]` placeholders with markdown links carrying a custom
  // scheme so the `a` component override below can swap them for image chips
  // without losing markdown context.
  const markdownSrc = text.replace(/\[Image #(\d+)\]/g, '[Image #$1](cc-image:$1)')

  return (
    <div className="va-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            const m = typeof href === 'string' ? href.match(/^cc-image:(\d+)$/) : null
            if (m && sessionId) {
              const n = m[1]
              const src = `/api/sessions/${sessionId}/images/${n}`
              return (
                <button
                  type="button"
                  className="va-image-chip"
                  onClick={(e) => {
                    e.stopPropagation()
                    openImage(src, `Image #${n}`)
                  }}
                >
                  {children}
                </button>
              )
            }
            return (
              <a href={href} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
                {children}
              </a>
            )
          },
        }}
      >
        {markdownSrc}
      </ReactMarkdown>
    </div>
  )
}

/**
 * Display labels for the four permission modes, aligned with the Claude Code
 * status bar wording ("auto mode on", "plan mode on", "accept edits on").
 */
const PERMISSION_MODE_LABEL: Record<StickyState['permissionMode'], string> = {
  auto: 'auto mode',
  plan: 'plan mode',
  acceptEdits: 'accept edits',
  default: 'default',
}

/**
 * 007-ui-information-revamp T040 — render the canonical sticky-state badge
 * set per FR-027. Permission mode + model are always visible; plan / auto /
 * worktree appear only when non-default.
 */
function StickyBadges({ sticky }: { sticky: StickyState }) {
  // `permissionMode === 'auto'` and `autoMode === true` (likewise `plan`) flip
  // together when the user enters those modes, so showing both would surface
  // two identical badges. Suppress the boolean badge when it would duplicate
  // the permission-mode badge.
  const showAuto = sticky.autoMode && sticky.permissionMode !== 'auto'
  const showPlan = sticky.planMode && sticky.permissionMode !== 'plan'
  return (
    <>
      <span className="dot" />
      <span className="va-sticky" data-kind="permission" data-value={sticky.permissionMode}>
        {PERMISSION_MODE_LABEL[sticky.permissionMode]}
      </span>
      {showPlan && (
        <>
          <span className="dot" />
          <span className="va-sticky" data-kind="plan">plan mode</span>
        </>
      )}
      {showAuto && (
        <>
          <span className="dot" />
          <span className="va-sticky" data-kind="auto">auto mode</span>
        </>
      )}
      {sticky.worktreeState && (
        <>
          <span className="dot" />
          <span className="va-sticky" data-kind="worktree">
            wt: {sticky.worktreeState.worktreeName}
          </span>
        </>
      )}
    </>
  )
}
