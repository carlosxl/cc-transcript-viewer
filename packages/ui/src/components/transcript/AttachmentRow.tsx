/**
 * Renders one attachment row (007-ui-information-revamp, T032).
 *
 * Discriminator dispatcher over the 22 attachment subtypes in
 * packages/shared/src/jsonl/schema.ts:585-820. Each subtype gets a labelled
 * card; specialised renderers handle the few payload shapes that benefit from
 * more than a generic table (task_reminder, skill_listing, hook_*, goal_status,
 * nested_memory).
 *
 * Standalone for now — wired into the flat-row dispatcher in a follow-up
 * integration task.
 */
import { useState } from 'react'
import type { AttachmentPayload, AttachmentRow as AttachmentRowType } from '@cc-viewer/shared'
import { getPlanFile } from '@/api/sessions'

interface AttachmentRowProps {
  row: AttachmentRowType
}

/**
 * Subtypes that compress to a single inline chip rather than a full card.
 * These are state-change markers (auto/plan mode toggles, date changes) where
 * the type label alone carries the full meaning — a card frame around them
 * just adds visual weight without adding information.
 */
const CHIP_SUBTYPES: Record<string, string> = {
  auto_mode: 'auto mode on',
  auto_mode_exit: 'auto mode off',
  plan_mode_exit: 'plan mode off',
  plan_mode_reentry: 'plan mode resumed',
  date_change: 'date change',
}

export function AttachmentRow({ row }: AttachmentRowProps) {
  const a = row.attachment as AttachmentPayload
  const chipLabel = CHIP_SUBTYPES[a.type]
  if (chipLabel) {
    return (
      <div className="va-attachment-chip" data-attachment-type={a.type}>
        <span className="va-attachment-chip-dot" aria-hidden="true">●</span>
        <span className="va-attachment-chip-label">{chipLabel}</span>
        {row.timestamp && <span className="va-attachment-chip-ts">{row.timestamp}</span>}
      </div>
    )
  }
  return (
    <div className="va-attachment" data-attachment-type={a.type}>
      <div className="va-attachment-head">
        <span className="va-attachment-type">{a.type.replace(/_/g, ' ')}</span>
        {row.timestamp && <span className="va-attachment-ts">{row.timestamp}</span>}
      </div>
      <AttachmentBody attachment={a} />
    </div>
  )
}

function AttachmentBody({ attachment }: { attachment: AttachmentPayload }) {
  switch (attachment.type) {
    case 'directory':
      return (
        <div className="va-attachment-body">
          <div className="va-attachment-path">{attachment.displayPath}</div>
          <pre className="va-attachment-listing">{attachment.content}</pre>
        </div>
      )
    case 'file': {
      const body = extractFileAttachmentBody(attachment.content)
      return (
        <div className="va-attachment-body">
          <div className="va-attachment-path">{attachment.displayPath}</div>
          {body && <pre className="va-attachment-snippet">{body}</pre>}
        </div>
      )
    }
    case 'edited_text_file':
      return (
        <div className="va-attachment-body">
          <div className="va-attachment-path">{attachment.filename}</div>
          <pre className="va-attachment-snippet">{attachment.snippet}</pre>
        </div>
      )
    case 'nested_memory':
      return (
        <div className="va-attachment-body">
          <div className="va-attachment-path">{attachment.displayPath}</div>
          {typeof attachment.content === 'string' ? (
            <pre className="va-attachment-snippet">{attachment.content}</pre>
          ) : (
            <pre className="va-attachment-snippet">{attachment.content.content}</pre>
          )}
        </div>
      )
    case 'skill_listing':
      return (
        <div className="va-attachment-body">
          <div className="va-attachment-meta">
            {attachment.skillCount} skills{attachment.isInitial ? ' · initial' : ' · update'}
          </div>
          <pre className="va-attachment-listing">{attachment.content}</pre>
        </div>
      )
    case 'deferred_tools_delta':
      return (
        <ListDeltaBody
          added={attachment.addedNames}
          removed={attachment.removedNames}
          readded={attachment.readdedNames}
        />
      )
    case 'mcp_instructions_delta':
      return <ListDeltaBody added={attachment.addedNames} removed={attachment.removedNames} />
    case 'task_reminder':
      return (
        <div className="va-attachment-body">
          <div className="va-attachment-meta">{attachment.itemCount} tasks</div>
          <ul className="va-attachment-tasklist">
            {attachment.content.map((task) => (
              <li key={task.id} data-status={task.status}>
                <span className="va-task-status">{task.status}</span>
                <span className="va-task-subject">{task.subject}</span>
                {task.owner && <span className="va-task-owner">@{task.owner}</span>}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'plan_mode':
      return <PlanModeBody attachment={attachment} />
    case 'auto_mode':
    case 'auto_mode_exit':
    case 'plan_mode_exit':
    case 'plan_mode_reentry':
    case 'ultrathink_effort':
    case 'date_change':
      return <KvBody attachment={attachment} />
    case 'queued_command':
      return (
        <div className="va-attachment-body">
          <div className="va-attachment-meta">{attachment.commandMode}</div>
          <pre className="va-attachment-snippet">{attachment.prompt}</pre>
        </div>
      )
    case 'command_permissions':
      return (
        <div className="va-attachment-body">
          <ul className="va-attachment-listing-ul">
            {attachment.allowedTools.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )
    case 'goal_status':
      return (
        <div className="va-attachment-body" data-met={attachment.met}>
          <div className="va-attachment-meta">{attachment.condition}</div>
          <div>met: {String(attachment.met)}</div>
          {attachment.reason && <div>reason: {attachment.reason}</div>}
          {typeof attachment.iterations === 'number' && <div>iterations: {attachment.iterations}</div>}
          {typeof attachment.durationMs === 'number' && <div>duration: {attachment.durationMs}ms</div>}
          {typeof attachment.tokens === 'number' && <div>tokens: {attachment.tokens}</div>}
        </div>
      )
    case 'hook_success':
    case 'hook_non_blocking_error':
      return (
        <div className="va-attachment-body">
          <div className="va-attachment-meta">
            {attachment.hookName} · {attachment.hookEvent} · exit {attachment.exitCode}
          </div>
          {attachment.stdout && <pre className="va-attachment-snippet">stdout: {attachment.stdout}</pre>}
          {attachment.stderr && <pre className="va-attachment-snippet">stderr: {attachment.stderr}</pre>}
        </div>
      )
    case 'hook_blocking_error':
      return (
        <div className="va-attachment-body">
          <div className="va-attachment-meta">
            {attachment.hookName} · {attachment.hookEvent}
          </div>
          <pre className="va-attachment-snippet">
            {typeof attachment.blockingError === 'string'
              ? attachment.blockingError
              : attachment.blockingError.blockingError}
          </pre>
        </div>
      )
    case 'hook_cancelled':
      return (
        <div className="va-attachment-body">
          <div className="va-attachment-meta">
            {attachment.hookName} · {attachment.hookEvent}
          </div>
        </div>
      )
    default:
      return <KvBody attachment={attachment} />
  }
}

function PlanModeBody({
  attachment,
}: {
  attachment: Extract<AttachmentPayload, { type: 'plan_mode' }>
}) {
  const path = attachment.planFilePath
  const planExists = attachment.planExists !== false
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'loaded'; content: string }
    | { status: 'error'; message: string }
  >({ status: 'idle' })

  const canView = Boolean(path) && planExists
  const onView = async () => {
    if (!canView || !path) return
    if (state.status === 'loaded' || state.status === 'loading') {
      // Toggle closed if already loaded; ignore while loading.
      if (state.status === 'loaded') setState({ status: 'idle' })
      return
    }
    setState({ status: 'loading' })
    try {
      const res = await getPlanFile(path)
      setState({ status: 'loaded', content: res.content })
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <div className="va-attachment-body">
      <div className="va-attachment-meta">
        plan mode {attachment.isSubAgent ? '(subagent)' : ''}
      </div>
      {path && (
        <div className="va-attachment-path-row">
          <span className="va-attachment-path">{path}</span>
          {canView && (
            <button
              type="button"
              className="va-attachment-link"
              onClick={(e) => {
                e.stopPropagation()
                onView()
              }}
            >
              {state.status === 'loading'
                ? 'loading…'
                : state.status === 'loaded'
                  ? 'hide plan'
                  : 'view plan'}
            </button>
          )}
        </div>
      )}
      {!planExists && (
        <div className="va-attachment-meta va-attachment-warn">plan file not yet created</div>
      )}
      {state.status === 'error' && (
        <div className="va-attachment-meta va-attachment-warn">failed to load: {state.message}</div>
      )}
      {state.status === 'loaded' && (
        <pre className="va-attachment-snippet va-plan-content" onClick={(e) => e.stopPropagation()}>
          {state.content}
        </pre>
      )}
    </div>
  )
}

function ListDeltaBody({ added, removed, readded }: { added: string[]; removed: string[]; readded?: string[] }) {
  return (
    <div className="va-attachment-body">
      {added.length > 0 && (
        <div className="va-delta-line va-delta-add">+ {added.join(', ')}</div>
      )}
      {readded && readded.length > 0 && (
        <div className="va-delta-line va-delta-readd">↺ {readded.join(', ')}</div>
      )}
      {removed.length > 0 && (
        <div className="va-delta-line va-delta-del">− {removed.join(', ')}</div>
      )}
    </div>
  )
}

function KvBody({ attachment }: { attachment: AttachmentPayload }) {
  const entries = Object.entries(attachment as unknown as Record<string, unknown>)
    .filter(([k]) => k !== 'type')
  if (entries.length === 0) {
    return <div className="va-attachment-body va-attachment-empty">(no payload)</div>
  }
  return (
    <dl className="va-attachment-body va-attachment-kv">
      {entries.map(([k, v]) => (
        <div key={k} className="va-attachment-kv-row">
          <dt>{k}</dt>
          <dd>{formatValue(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * `file` attachments store the inlined file body under `content`. The observed
 * shape is `{ type: 'text', file: { content: string, ... } }` (same envelope
 * the Read tool emits). A few legacy variants ship a bare string or a content
 * blocks array — handle all three.
 */
function extractFileAttachmentBody(content: unknown): string | null {
  if (content == null) return null
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const text = content
      .map((b) => (b && typeof b === 'object' && typeof (b as { text?: unknown }).text === 'string' ? (b as { text: string }).text : ''))
      .filter(Boolean)
      .join('\n')
    return text || null
  }
  if (typeof content === 'object') {
    const o = content as { file?: { content?: unknown }; text?: unknown }
    if (o.file && typeof o.file.content === 'string') return o.file.content
    if (typeof o.text === 'string') return o.text
  }
  return null
}

function formatValue(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}
