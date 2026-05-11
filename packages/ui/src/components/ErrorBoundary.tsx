// Root-level React 19 ErrorBoundary — closes F-1 (BLOCKING D-40.2).
//
// React 19 still requires class components for error boundaries (no hooks
// equivalent in stable). This component catches any descendant render-path
// throw, logs it via console.error so DevTools always sees it, and renders a
// CONTAINED fallback panel (does NOT replace the entire page chrome).
//
// The fallback shows error.message + error.stack + info.componentStack and
// exposes a Copy button that writes the entire diagnostic to the user's
// clipboard so the human verifier can paste it into the gap-closure record.
//
// Threat model (Plan 02-12 §threat_model):
//   - Stack traces are bound to 127.0.0.1; never transmitted (SYS-03 invariant).
//   - All renders use React text interpolation — no dangerouslySetInnerHTML.
//   - Copy button is try/catch'd around a single navigator.clipboard.writeText
//     call; failures swallowed silently (Linear/Raycast aesthetic — no toast).
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
  info: ErrorInfo | null
  copied: boolean
}

interface Props {
  children: ReactNode
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null, copied: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log so DevTools captures it even if the user never clicks Copy.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
    this.setState({ error, info })
  }

  private buildPasteText(): string {
    const e = this.state.error
    const info = this.state.info
    const header = '=== ErrorBoundary fallback ==='
    const msg = `Message: ${e?.message ?? '(no message)'}`
    const stack = `\nStack:\n${e?.stack ?? '(no stack)'}`
    const cstack = `\nComponentStack:\n${info?.componentStack ?? '(no componentStack)'}`
    return `${header}\n${msg}${stack}${cstack}\n`
  }

  private onCopy = async (): Promise<void> => {
    const text = this.buildPasteText()
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for older browsers (Safari <13.1): hidden textarea + execCommand.
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.top = '-1000px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      this.setState({ copied: true })
      window.setTimeout(() => this.setState({ copied: false }), 1500)
    } catch {
      // Silent failure (no toast — matches CodeBlock copy-button pattern).
    }
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    const e = this.state.error
    const info = this.state.info
    return (
      <div
        role="alert"
        className="min-h-screen p-8 bg-background text-foreground font-sans"
      >
        <h1 className="text-lg font-semibold text-destructive mb-2">
          Something went wrong rendering the page
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          The render tree threw an error. The page is preserved here so you can
          capture the stack trace. Reload after the fix lands.
        </p>
        <div className="mb-4">
          <button
            type="button"
            onClick={this.onCopy}
            aria-label="Copy error details"
            className="px-3 py-1.5 text-xs font-semibold rounded-sm border border-border bg-accent hover:bg-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {this.state.copied ? 'Copied!' : 'Copy error details'}
          </button>
        </div>
        <section className="mb-4">
          <h2 className="text-sm font-semibold mb-1">Message</h2>
          <pre className="text-xs font-mono p-3 bg-muted rounded-sm overflow-x-auto whitespace-pre-wrap">
            {e.message}
          </pre>
        </section>
        <section className="mb-4">
          <h2 className="text-sm font-semibold mb-1">Stack</h2>
          <pre className="text-xs font-mono p-3 bg-muted rounded-sm overflow-x-auto whitespace-pre-wrap">
            {e.stack ?? '(no stack)'}
          </pre>
        </section>
        <section>
          <h2 className="text-sm font-semibold mb-1">Component Stack</h2>
          <pre className="text-xs font-mono p-3 bg-muted rounded-sm overflow-x-auto whitespace-pre-wrap">
            {info?.componentStack ?? '(no componentStack)'}
          </pre>
        </section>
      </div>
    )
  }
}
