import { describe, it, expect } from 'vitest'
import { projectStickyState, DEFAULT_STICKY_STATE } from './useStickyState'
import type { ClaudeRowOrUnknown } from '@/lib/types'

describe('projectStickyState (007 Phase 2 skeleton)', () => {
  it('returns defaults for a turn anchor before any sticky event', () => {
    const rows = [userPrompt('u1', 'p1', 'hi')] as unknown as ClaudeRowOrUnknown[]
    const m = projectStickyState(rows)
    expect(m.get('p1')).toEqual(DEFAULT_STICKY_STATE)
  })

  it('carries permission-mode forward across subsequent turns', () => {
    const rows = [
      permissionMode('plan'),
      userPrompt('u1', 'p1', 'hi'),
      userPrompt('u2', 'p2', 'still planning'),
    ] as unknown as ClaudeRowOrUnknown[]
    const m = projectStickyState(rows)
    expect(m.get('p1')?.permissionMode).toBe('plan')
    expect(m.get('p2')?.permissionMode).toBe('plan')
  })

  it('captures model identifier from preceding assistant rows', () => {
    const rows = [
      userPrompt('u1', 'p1', 'first'),
      assistantWithModel('a1', 'claude-opus-4-7'),
      userPrompt('u2', 'p2', 'second'),
    ] as unknown as ClaudeRowOrUnknown[]
    const m = projectStickyState(rows)
    expect(m.get('p2')?.model).toBe('claude-opus-4-7')
  })

  it('reflects plan-mode entry/exit attachments as planMode toggles', () => {
    const rows = [
      userPrompt('u1', 'p1', 'hi'),
      attachmentRow({ type: 'plan_mode', reminderType: 'x', isSubAgent: false, planFilePath: '', planExists: false }),
      userPrompt('u2', 'p2', 'in plan'),
      attachmentRow({ type: 'plan_mode_exit' }),
      userPrompt('u3', 'p3', 'out of plan'),
    ] as unknown as ClaudeRowOrUnknown[]
    const m = projectStickyState(rows)
    expect(m.get('p1')?.planMode).toBe(false)
    expect(m.get('p2')?.planMode).toBe(true)
    expect(m.get('p3')?.planMode).toBe(false)
  })

  it('reflects auto-mode entry/exit attachments as autoMode toggles', () => {
    const rows = [
      userPrompt('u1', 'p1', 'pre-auto'),
      attachmentRow({ type: 'auto_mode' }),
      userPrompt('u2', 'p2', 'in auto'),
      attachmentRow({ type: 'auto_mode_exit' }),
      userPrompt('u3', 'p3', 'post-auto'),
    ] as unknown as ClaudeRowOrUnknown[]
    const m = projectStickyState(rows)
    expect(m.get('p1')?.autoMode).toBe(false)
    expect(m.get('p2')?.autoMode).toBe(true)
    expect(m.get('p3')?.autoMode).toBe(false)
  })

  it('carries worktree-state forward', () => {
    const ws = {
      originalBranch: 'main',
      originalCwd: '/repo',
      originalHeadCommit: 'abc',
      sessionId: 's1',
      worktreeBranch: 'feature',
      worktreeName: 'wt-feature',
      worktreePath: '/repo/.claude/worktrees/wt-feature',
    }
    const rows = [
      userPrompt('u1', 'p1', 'before'),
      { type: 'worktree-state', worktreeSession: ws } as unknown as ClaudeRowOrUnknown,
      userPrompt('u2', 'p2', 'inside'),
    ] as ClaudeRowOrUnknown[]
    const m = projectStickyState(rows)
    expect(m.get('p1')?.worktreeState).toBeNull()
    expect(m.get('p2')?.worktreeState).toEqual(ws)
  })

  it('records model switch mid-session', () => {
    const rows = [
      userPrompt('u1', 'p1', 'first'),
      assistantWithModel('a1', 'claude-sonnet-4-6'),
      userPrompt('u2', 'p2', 'second'),
      assistantWithModel('a2', 'claude-opus-4-7'),
      userPrompt('u3', 'p3', 'third'),
    ] as unknown as ClaudeRowOrUnknown[]
    const m = projectStickyState(rows)
    expect(m.get('p1')?.model).toBe('')
    expect(m.get('p2')?.model).toBe('claude-sonnet-4-6')
    expect(m.get('p3')?.model).toBe('claude-opus-4-7')
  })

  it('live-tail incremental: rebuilding on appended rows preserves earlier state', () => {
    // Simulate the live-tail case: first batch establishes state, second batch
    // arrives later — running the projection on the combined stream must
    // produce the same per-Turn state as running it once on the full stream.
    const batchA = [
      permissionMode('plan'),
      userPrompt('u1', 'p1', 'first'),
      assistantWithModel('a1', 'claude-sonnet-4-6'),
    ] as unknown as ClaudeRowOrUnknown[]

    const batchB = [
      userPrompt('u2', 'p2', 'second'),
      assistantWithModel('a2', 'claude-opus-4-7'),
    ] as unknown as ClaudeRowOrUnknown[]

    const combined = [...batchA, ...batchB]
    const mFull = projectStickyState(combined)
    expect(mFull.get('p1')?.model).toBe('') // p1 anchored before assistant row arrived
    expect(mFull.get('p2')?.model).toBe('claude-sonnet-4-6')
    expect(mFull.get('p1')?.permissionMode).toBe('plan')
    expect(mFull.get('p2')?.permissionMode).toBe('plan')
  })
})

function userPrompt(uuid: string, promptId: string, text: string): Record<string, unknown> {
  return {
    type: 'user',
    uuid,
    promptId,
    timestamp: '2026-05-26T00:00:00Z',
    message: { role: 'user', content: text },
  }
}

function assistantWithModel(uuid: string, model: string): Record<string, unknown> {
  return {
    type: 'assistant',
    uuid,
    timestamp: '2026-05-26T00:00:01Z',
    message: { role: 'assistant', model, content: [] },
  }
}

function permissionMode(mode: string): Record<string, unknown> {
  return { type: 'permission-mode', permissionMode: mode, sessionId: 's' }
}

function attachmentRow(attachment: Record<string, unknown>): Record<string, unknown> {
  return { type: 'attachment', attachment, timestamp: '2026-05-26T00:00:00Z' }
}
