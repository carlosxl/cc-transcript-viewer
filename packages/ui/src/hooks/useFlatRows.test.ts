import { describe, it, expect } from 'vitest'
import { buildFlatRows, type FlatRowExpansion, type FlatRowFilters } from './useFlatRows'
import { DEFAULT_STICKY_STATE, type StickyState } from './useStickyState'
import type { ClaudeRowOrUnknown } from '@/lib/types'

const noExpansion: FlatRowExpansion = {
  expandedTurnIds: new Set(),
  expandedRequestIds: new Set(),
  expandedBlockIds: new Set(),
}
const allOn: FlatRowFilters = {
  showAttachments: true,
  showSystemEvents: true,
  showInlineStateChanges: true,
}

function emptySticky(): Map<string, StickyState> {
  return new Map<string, StickyState>()
}

describe('buildFlatRows (007 Phase 2 skeleton)', () => {
  it('emits a turn-header for each human-prompted user row with a promptId', () => {
    const rows = [
      makeUserRow('u1', 'p1', 'hello world'),
      makeAssistantRow('a1', 'r1'),
      makeUserRow('u2', 'p2', 'follow up'),
    ] as unknown as ClaudeRowOrUnknown[]
    const out = buildFlatRows(rows, noExpansion, allOn, emptySticky())
    const headers = out.filter((r) => r.kind === 'turn-header')
    expect(headers.map((r) => 'turnId' in r ? r.turnId : '')).toEqual(['p1', 'p2'])
  })

  it('emits a single request RowItem per requestId even with multiple assistant rows', () => {
    const rows = [
      makeUserRow('u1', 'p1', 'do thing'),
      makeAssistantRow('a1', 'r1'),
      makeAssistantRow('a2', 'r1'), // same requestId
      makeAssistantRow('a3', 'r2'),
    ] as unknown as ClaudeRowOrUnknown[]
    const out = buildFlatRows(rows, noExpansion, allOn, emptySticky())
    const requestIds = out
      .filter((r) => r.kind === 'request')
      .map((r) => ('requestId' in r ? r.requestId : ''))
    expect(requestIds).toEqual(['r1', 'r2'])
  })

  it('renders unknown-row entries for unrecognised types (FR-007)', () => {
    const rows: ClaudeRowOrUnknown[] = [
      { type: 'unknown', raw: { type: 'future-row', uuid: 'x1' } },
    ]
    const out = buildFlatRows(rows, noExpansion, allOn, emptySticky())
    expect(out).toHaveLength(1)
    expect(out[0]!.kind).toBe('unknown-row')
  })

  it('hides attachments when showAttachments is false', () => {
    const rows = [
      makeUserRow('u1', 'p1', 'hello'),
      makeAttachmentRow('att1', 'skill_listing'),
    ] as unknown as ClaudeRowOrUnknown[]
    const off: FlatRowFilters = { ...allOn, showAttachments: false }
    const out = buildFlatRows(rows, noExpansion, off, emptySticky())
    expect(out.some((r) => r.kind === 'attachment-summary')).toBe(false)
  })

  it('attaches sticky state on the turn-header from the input map', () => {
    const sticky = new Map<string, StickyState>([
      ['p1', { ...DEFAULT_STICKY_STATE, permissionMode: 'plan' }],
    ])
    const rows = [makeUserRow('u1', 'p1', 'hello')] as unknown as ClaudeRowOrUnknown[]
    const out = buildFlatRows(rows, noExpansion, allOn, sticky)
    const header = out.find((r) => r.kind === 'turn-header')
    expect(header && 'sticky' in header && header.sticky?.permissionMode).toBe('plan')
  })

  it('emits attachment-summary rows immediately after the turn-header (before requests)', () => {
    const rows = [
      makeUserRow('u1', 'p1', 'hello'),
      makeAttachmentRow('att1', 'skill_listing'),
      makeAssistantRow('a1', 'r1'),
    ] as unknown as ClaudeRowOrUnknown[]
    const out = buildFlatRows(rows, noExpansion, allOn, emptySticky())
    expect(out.map((r) => r.kind)).toEqual([
      'turn-header',
      'attachment-summary',
      'request',
    ])
  })

  it('attributes attachments to their explicit promptId even when physically later', () => {
    // Attachment row appears AFTER turn p2 but carries promptId p1 — must be
    // attributed back to turn p1, not p2 (plan §2 rule 2, FR-009).
    const rows = [
      makeUserRow('u1', 'p1', 'first'),
      makeAssistantRow('a1', 'r1'),
      makeUserRow('u2', 'p2', 'second'),
      makeAttachmentRowFor('att1', 'skill_listing', 'p1'),
    ] as unknown as ClaudeRowOrUnknown[]
    const out = buildFlatRows(rows, noExpansion, allOn, emptySticky())
    const indexOfP1Attach = out.findIndex(
      (r) => r.kind === 'attachment-summary' && r.turnId === 'p1',
    )
    const indexOfP2Header = out.findIndex(
      (r) => r.kind === 'turn-header' && r.turnId === 'p2',
    )
    expect(indexOfP1Attach).toBeGreaterThan(-1)
    expect(indexOfP1Attach).toBeLessThan(indexOfP2Header)
  })

  it('falls back to the closest preceding human prompt when promptId is absent', () => {
    const rows = [
      makeUserRow('u1', 'p1', 'first'),
      makeAssistantRow('a1', 'r1'),
      makeUserRow('u2', 'p2', 'second'),
      makeAttachmentRow('att-no-pid', 'task_reminder'),
    ] as unknown as ClaudeRowOrUnknown[]
    const out = buildFlatRows(rows, noExpansion, allOn, emptySticky())
    const att = out.find((r) => r.kind === 'attachment-summary')
    expect(att && 'turnId' in att && att.turnId).toBe('p2')
  })

  it('drops attachments that appear before any human prompt', () => {
    const rows = [
      makeAttachmentRow('orphan', 'skill_listing'),
      makeUserRow('u1', 'p1', 'hello'),
    ] as unknown as ClaudeRowOrUnknown[]
    const out = buildFlatRows(rows, noExpansion, allOn, emptySticky())
    expect(out.some((r) => r.kind === 'attachment-summary')).toBe(false)
  })
})

function makeUserRow(uuid: string, promptId: string, text: string): Record<string, unknown> {
  return {
    type: 'user',
    uuid,
    promptId,
    timestamp: '2026-05-26T00:00:00Z',
    message: { role: 'user', content: text },
  }
}

function makeAssistantRow(uuid: string, requestId: string): Record<string, unknown> {
  return {
    type: 'assistant',
    uuid,
    requestId,
    timestamp: '2026-05-26T00:00:01Z',
    message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] },
  }
}

function makeAttachmentRow(uuid: string, attachmentType: string): Record<string, unknown> {
  return {
    type: 'attachment',
    uuid,
    timestamp: '2026-05-26T00:00:00Z',
    attachment: { type: attachmentType, skillCount: 1, isInitial: true, content: 'x' },
  }
}

function makeAttachmentRowFor(
  uuid: string,
  attachmentType: string,
  promptId: string,
): Record<string, unknown> {
  return {
    type: 'attachment',
    uuid,
    promptId,
    timestamp: '2026-05-26T00:00:00Z',
    attachment: { type: attachmentType, skillCount: 1, isInitial: true, content: 'x' },
  }
}
