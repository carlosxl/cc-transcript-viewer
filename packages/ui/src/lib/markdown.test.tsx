import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { renderInline } from './markdown'

describe('renderInline', () => {
  it('renders **bold** segments as <strong>', () => {
    const { container } = render(<div>{renderInline('hello **world**')}</div>)
    const strong = container.querySelector('strong')
    expect(strong?.textContent).toBe('world')
  })

  it('renders `code` segments as <code>', () => {
    const { container } = render(<div>{renderInline('run `npm test` to verify')}</div>)
    const code = container.querySelector('code')
    expect(code?.textContent).toBe('npm test')
  })

  it('renders explicit \\n as <br/>', () => {
    const { container } = render(<div>{renderInline('line one\nline two')}</div>)
    expect(container.querySelectorAll('br').length).toBe(1)
    expect(container.textContent).toBe('line oneline two')
  })

  it('returns null for empty / nullish input (no DOM cost)', () => {
    expect(renderInline('')).toBeNull()
    expect(renderInline(null)).toBeNull()
    expect(renderInline(undefined)).toBeNull()
  })

  it('leaves unrecognized markdown verbatim', () => {
    const { container } = render(<div>{renderInline('plain text without markup')}</div>)
    expect(container.textContent).toBe('plain text without markup')
    expect(container.querySelector('strong')).toBeNull()
    expect(container.querySelector('code')).toBeNull()
  })
})
