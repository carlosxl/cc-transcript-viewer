import { describe, it, expect } from 'vitest'
import type { ToolUse } from '@cc-viewer/shared'
import { formatCommand } from './formatCommand'

function tu(name: string, input: Record<string, unknown>): ToolUse {
  return { id: 'tu', name, input }
}

describe('formatCommand', () => {
  it('formats Bash as the command verbatim', () => {
    expect(formatCommand(tu('Bash', { command: 'ls -la /tmp' }))).toBe('ls -la /tmp')
  })

  it('formats Read with no offset as cat', () => {
    expect(formatCommand(tu('Read', { file_path: '/etc/hosts' }))).toBe('cat /etc/hosts')
  })

  it('formats Read with offset+limit using sed slicing', () => {
    expect(formatCommand(tu('Read', { file_path: '/a.txt', offset: 10, limit: 20 }))).toBe(
      "sed -n '11,30p' /a.txt",
    )
  })

  it('formats Glob with pattern and path', () => {
    expect(formatCommand(tu('Glob', { pattern: '**/*.ts', path: 'src' }))).toBe(
      "find src -name '**/*.ts' -type f",
    )
  })

  it('formats Grep with pattern only', () => {
    expect(formatCommand(tu('Grep', { pattern: 'TODO' }))).toBe("grep -R TODO .")
  })

  it('formats WebFetch as curl', () => {
    expect(formatCommand(tu('WebFetch', { url: 'https://example.com/api' }))).toBe(
      'curl https://example.com/api',
    )
  })

  it('falls back to JSON for unknown tools', () => {
    const out = formatCommand(tu('Magic', { foo: 'bar' }))
    expect(out).toContain('# tool=Magic')
    expect(out).toContain('"foo": "bar"')
  })

  it('quotes paths containing spaces or special chars', () => {
    expect(formatCommand(tu('Read', { file_path: '/tmp/a b.txt' }))).toBe(
      "cat '/tmp/a b.txt'",
    )
  })
})
