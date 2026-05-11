import { describe, it, expect, beforeEach } from 'vitest'
import { useLiveStore } from './useLiveStore'

beforeEach(() => {
  useLiveStore.setState({ autoFollow: true, pendingCount: 0 })
})

describe('useLiveStore', () => {
  it('default state has autoFollow=true and pendingCount=0', () => {
    expect(useLiveStore.getState().autoFollow).toBe(true)
    expect(useLiveStore.getState().pendingCount).toBe(0)
  })

  it('incrementPending increments by 1 by default and by N when given', () => {
    useLiveStore.getState().incrementPending()
    expect(useLiveStore.getState().pendingCount).toBe(1)
    useLiveStore.getState().incrementPending(3)
    expect(useLiveStore.getState().pendingCount).toBe(4)
  })

  it('clearPending zeroes the count', () => {
    useLiveStore.getState().incrementPending(5)
    useLiveStore.getState().clearPending()
    expect(useLiveStore.getState().pendingCount).toBe(0)
  })

  it('setAutoFollow(true) also clears pendingCount when there were pending', () => {
    useLiveStore.setState({ autoFollow: false, pendingCount: 7 })
    useLiveStore.getState().setAutoFollow(true)
    expect(useLiveStore.getState().autoFollow).toBe(true)
    expect(useLiveStore.getState().pendingCount).toBe(0)
  })

  it('setAutoFollow(false) does not touch pendingCount', () => {
    useLiveStore.setState({ autoFollow: true, pendingCount: 3 })
    useLiveStore.getState().setAutoFollow(false)
    expect(useLiveStore.getState().autoFollow).toBe(false)
    expect(useLiveStore.getState().pendingCount).toBe(3)
  })

  it('setAutoFollow(true) when nothing pending leaves count at 0 (no-op branch)', () => {
    useLiveStore.setState({ autoFollow: false, pendingCount: 0 })
    useLiveStore.getState().setAutoFollow(true)
    expect(useLiveStore.getState().autoFollow).toBe(true)
    expect(useLiveStore.getState().pendingCount).toBe(0)
  })
})
