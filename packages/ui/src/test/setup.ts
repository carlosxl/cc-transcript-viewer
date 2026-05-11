import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// matchMedia mock — UI uses prefers-color-scheme on init (D-04)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})

// navigator.clipboard mock — VIEW-07 copy button tests rely on this
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  configurable: true,
  value: { writeText: vi.fn(async () => undefined) },
})

// ResizeObserver mock — react-virtuoso needs it; jsdom doesn't provide it
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
