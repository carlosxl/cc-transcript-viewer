import { describe, it, expect, beforeEach } from 'vitest'
import {
  useNavigationStore,
  deriveCurrentEntry,
  entryToId,
  encodeLocationHash,
  decodeLocationHash,
} from './useNavigationStore'

beforeEach(() => {
  useNavigationStore.setState({ drillStack: [] })
})

describe('useNavigationStore', () => {
  it('pushSubagent appends a frame to the drill stack', () => {
    useNavigationStore.getState().pushSubagent({ sessionId: 'sess', agentId: 'a1' })
    useNavigationStore.getState().pushSubagent({ sessionId: 'sess', agentId: 'a2' })
    expect(useNavigationStore.getState().drillStack).toEqual([
      { sessionId: 'sess', agentId: 'a1' },
      { sessionId: 'sess', agentId: 'a2' },
    ])
  })

  it('popSubagent removes the top frame', () => {
    useNavigationStore.setState({
      drillStack: [
        { sessionId: 'sess', agentId: 'a1' },
        { sessionId: 'sess', agentId: 'a2' },
      ],
    })
    useNavigationStore.getState().popSubagent()
    expect(useNavigationStore.getState().drillStack).toEqual([{ sessionId: 'sess', agentId: 'a1' }])
  })

  it('truncateTo trims the stack to the given length', () => {
    useNavigationStore.setState({
      drillStack: [
        { sessionId: 'sess', agentId: 'a1' },
        { sessionId: 'sess', agentId: 'a2' },
        { sessionId: 'sess', agentId: 'a3' },
      ],
    })
    useNavigationStore.getState().truncateTo(1)
    expect(useNavigationStore.getState().drillStack.length).toBe(1)
    useNavigationStore.getState().truncateTo(0)
    expect(useNavigationStore.getState().drillStack.length).toBe(0)
  })
})

describe('deriveCurrentEntry', () => {
  it('returns undefined when no active session', () => {
    expect(deriveCurrentEntry(null, [])).toBeUndefined()
  })

  it('returns session entry when drill stack is empty', () => {
    expect(deriveCurrentEntry('sess', [])).toEqual({ kind: 'session', sessionId: 'sess' })
  })

  it('returns subagent entry when drill stack top matches active session', () => {
    const entry = deriveCurrentEntry('sess', [{ sessionId: 'sess', agentId: 'a1' }])
    expect(entry).toEqual({ kind: 'subagent', sessionId: 'sess', agentId: 'a1' })
  })

  it('falls back to session entry when drill stack is for a different session', () => {
    // Defensive: stale drill stack from a previous session shouldn't override the bottom session.
    const entry = deriveCurrentEntry('current', [{ sessionId: 'stale', agentId: 'oldagent' }])
    expect(entry).toEqual({ kind: 'session', sessionId: 'current' })
  })
})

describe('entryToId', () => {
  it('produces stable, distinct ids per entry kind', () => {
    expect(entryToId({ kind: 'session', sessionId: 's' })).toBe('session:s')
    expect(entryToId({ kind: 'subagent', sessionId: 's', agentId: 'a' })).toBe('subagent:s:a')
  })
})

describe('encodeLocationHash / decodeLocationHash round-trip', () => {
  it('encodes a session entry', () => {
    expect(encodeLocationHash({ kind: 'session', sessionId: 'abc' })).toBe('#/sessions/abc')
  })

  it('encodes a subagent entry', () => {
    expect(encodeLocationHash({ kind: 'subagent', sessionId: 'abc', agentId: 'xyz' }))
      .toBe('#/sessions/abc/subagents/xyz')
  })

  it('encodes empty string when no entry', () => {
    expect(encodeLocationHash(undefined)).toBe('')
  })

  it('decodes a session hash', () => {
    expect(decodeLocationHash('#/sessions/abc')).toEqual({ sessionId: 'abc', drillStack: [] })
  })

  it('decodes a subagent hash with single drill frame', () => {
    expect(decodeLocationHash('#/sessions/abc/subagents/xyz')).toEqual({
      sessionId: 'abc',
      drillStack: [{ sessionId: 'abc', agentId: 'xyz' }],
    })
  })

  it('returns null for unrecognized hashes', () => {
    expect(decodeLocationHash('')).toBeNull()
    expect(decodeLocationHash('#/foo')).toBeNull()
    expect(decodeLocationHash('#/sessions/')).toBeNull()
  })

  it('decodes URL-encoded session and agent ids', () => {
    expect(decodeLocationHash('#/sessions/has%20space/subagents/has%2Fslash')).toEqual({
      sessionId: 'has space',
      drillStack: [{ sessionId: 'has space', agentId: 'has/slash' }],
    })
  })
})
