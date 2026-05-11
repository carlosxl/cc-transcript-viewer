// Tests for ErrorBoundary — fix for D-40.2 / F-1 (BLOCKING).
// The boundary must catch render-path throws so the page never blanks to white.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'

import { ErrorBoundary } from './ErrorBoundary'

function Throw(): never {
  throw new Error('boom-from-test')
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>
let writeTextMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  // React 19 logs caught errors via console.error in dev; suppress to keep test
  // output clean while still allowing assertions on call shape if needed.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  // CodeBlock's Test 5 (run alphabetically before this file) sets
  // `navigator.clipboard = undefined` and never restores it — defensively
  // re-install the writeText mock here so this test stays isolation-safe.
  writeTextMock = vi.fn(async () => undefined)
  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    configurable: true,
    value: { writeText: writeTextMock },
  })
})

afterEach(() => {
  cleanup()
  consoleErrorSpy.mockRestore()
})

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="ok">hello</div>
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('ok')).toHaveTextContent('hello')
  })

  it('catches throw and renders fallback containing error.message + componentStack', () => {
    render(
      <ErrorBoundary>
        <Throw />
      </ErrorBoundary>,
    )

    // Fallback panel uses role="alert"
    expect(screen.getByRole('alert')).toBeInTheDocument()
    // error.message visible (use getAllByText — text also appears in stack/componentStack)
    expect(screen.getAllByText(/boom-from-test/).length).toBeGreaterThan(0)
    // React's componentStack format includes "at Throw"
    expect(document.body.textContent ?? '').toMatch(/at Throw/)
    // Children NOT rendered
    expect(screen.queryByTestId('ok')).toBeNull()
  })

  it('Copy button writes error+stack+componentStack to navigator.clipboard.writeText', async () => {
    render(
      <ErrorBoundary>
        <Throw />
      </ErrorBoundary>,
    )

    const button = screen.getByRole('button', { name: /copy/i })
    await act(async () => {
      fireEvent.click(button)
    })
    // Flush the pending awaited writeText promise inside onCopy.
    await act(async () => {
      await Promise.resolve()
    })

    expect(writeTextMock).toHaveBeenCalledTimes(1)

    const arg = writeTextMock.mock.calls[0]?.[0] as string
    expect(arg).toContain('boom-from-test')
    expect(arg).toMatch(/at Throw/)
    expect(arg).toContain('ErrorBoundary fallback')
  })
})
