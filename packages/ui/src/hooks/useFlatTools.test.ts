import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFlatTools } from './useFlatTools'
import { projectSessionView } from './useSessionView'
import { buildMultiTurnDetail } from '@/test/fixtures'

describe('useFlatTools', () => {
  const view = projectSessionView(buildMultiTurnDetail(), {
    id: 's',
    title: 't',
    isLive: false,
  })

  it('emits both tool_use and diff blocks across all requests, in document order', () => {
    const { result } = renderHook(() => useFlatTools(view))
    const kinds = result.current.map((it) => it.block.kind)
    // Bash (tool_use), Agent (tool_use), Edit (tool_use + paired diff)
    expect(kinds).toEqual(['tool_use', 'tool_use', 'tool_use', 'diff'])
  })

  it('binds each item back to its owning request and turn', () => {
    const { result } = renderHook(() => useFlatTools(view))
    const first = result.current[0]
    expect(first.request.id).toBe('a-a')
    expect(first.turn.id).toBe('u-a')
    const last = result.current[result.current.length - 1]
    expect(last.request.id).toBe('a-c2')
    expect(last.turn.id).toBe('u-c')
  })

  it('uses stable bid of "${requestId}:b${blockIdx}"', () => {
    const { result } = renderHook(() => useFlatTools(view))
    for (const item of result.current) {
      expect(item.bid).toMatch(/^a-[a-z0-9]+:b\d+$/)
    }
  })

  it('returns empty when no view is provided', () => {
    const { result } = renderHook(() => useFlatTools(null))
    expect(result.current).toEqual([])
  })
})
