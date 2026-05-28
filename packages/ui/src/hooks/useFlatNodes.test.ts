import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFlatNodes } from './useFlatNodes'
import { projectSessionView } from './useSessionView'
import { buildMultiTurnDetail } from '@/test/fixtures'

describe('useFlatNodes', () => {
  const view = projectSessionView(buildMultiTurnDetail(), {
    id: 's',
    title: 't',
    isLive: false,
  })

  it('emits user-prompt then request nodes per turn, in document order', () => {
    const { result } = renderHook(() => useFlatNodes(view))
    expect(result.current.map((n) => n.id)).toEqual([
      'u-a', 'a-a',
      'u-b', 'a-b',
      'u-c', 'a-c1', 'a-c2',
    ])
  })

  it('includes stderr turns (filtering is the prompt hook’s job, not this one)', () => {
    const { result } = renderHook(() => useFlatNodes(view))
    const ids = result.current.map((n) => n.id)
    expect(ids).toContain('u-b')
  })

  it('attaches FocusedNodeMeta with idx/total on request entries', () => {
    const { result } = renderHook(() => useFlatNodes(view))
    const c2 = result.current.find((n) => n.id === 'a-c2')!
    expect(c2.meta.kind).toBe('request')
    expect(c2.meta.idx).toBe(2)
    expect(c2.meta.total).toBe(2)
  })

  it('returns an empty list when no view is provided', () => {
    const { result } = renderHook(() => useFlatNodes(null))
    expect(result.current).toEqual([])
  })
})
