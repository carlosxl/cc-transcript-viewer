// packages/server/src/reader/session-cache.ts

/**
 * LRU cache keyed by sessionId (D-18, capacity 3 by default).
 * Uses Map's insertion-order preservation to identify the LRU entry.
 *
 * The `mtime` gate on `get()` invalidates stale entries without requiring
 * the caller to clear them — each get() takes the current disk mtime and
 * returns null if it disagrees with the cached entry's mtime.
 */
export interface CacheEntry<V> {
  value: V
  mtimeMs: number
}

export class SessionCache<V> {
  private map = new Map<string, CacheEntry<V>>()

  constructor(private readonly capacity: number = 3) {}

  /** Returns the cached value only if the stored mtime matches. */
  get(key: string, mtimeMs: number): V | null {
    const entry = this.map.get(key)
    if (!entry) return null
    if (entry.mtimeMs !== mtimeMs) {
      this.map.delete(key)
      return null
    }
    // Refresh position: delete + reinsert pushes to end of Map iteration order.
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }

  set(key: string, value: V, mtimeMs: number): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, { value, mtimeMs })
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }

  size(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  /** Drop a single entry (no-op when absent). Used by W3 to invalidate on append. */
  delete(key: string): void {
    this.map.delete(key)
  }
}
