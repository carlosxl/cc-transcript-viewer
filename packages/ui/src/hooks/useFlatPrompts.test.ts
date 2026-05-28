import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFlatPrompts } from './useFlatPrompts'
import { projectSessionView } from './useSessionView'
import { buildMultiTurnDetail } from '@/test/fixtures'

describe('useFlatPrompts', () => {
  it('excludes turns whose prompt begins with the [stderr] envelope', () => {
    const view = projectSessionView(buildMultiTurnDetail(), { id: 's', title: 't', isLive: false })
    const { result } = renderHook(() => useFlatPrompts(view))
    const ids = result.current.map((p) => p.id)
    expect(ids).toEqual(['u-a', 'u-c'])
    expect(ids).not.toContain('u-b')
  })

  it('returns empty when no view is provided', () => {
    const { result } = renderHook(() => useFlatPrompts(null))
    expect(result.current).toEqual([])
  })
})
