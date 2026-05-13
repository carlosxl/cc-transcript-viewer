import { describe, it, expect } from 'vitest'
import { classifyUserText } from './classifyUserText'

describe('classifyUserText', () => {
  it('returns text for plain user prose', () => {
    const r = classifyUserText('Please refactor auth.ts')
    expect(r.kind).toBe('text')
    if (r.kind === 'text') expect(r.text).toBe('Please refactor auth.ts')
  })

  it('returns text for empty input', () => {
    const r = classifyUserText('')
    expect(r.kind).toBe('text')
  })

  it('parses a /clear command with empty args + message', () => {
    const src = `<command-name>/clear</command-name>
            <command-message>clear</command-message>
            <command-args></command-args>`
    const r = classifyUserText(src)
    expect(r.kind).toBe('command')
    if (r.kind === 'command') {
      expect(r.name).toBe('/clear')
      expect(r.message).toBe('clear')
      expect(r.args).toBe('')
      expect(r.stderr).toBe('')
    }
  })

  it('parses a command with args + stderr passthrough', () => {
    const src = `<command-name>/security-review</command-name>
<command-message>security-review</command-message>
<command-args>master branch</command-args>
<local-command-stderr>fatal: ambiguous argument</local-command-stderr>`
    const r = classifyUserText(src)
    expect(r.kind).toBe('command')
    if (r.kind === 'command') {
      expect(r.name).toBe('/security-review')
      expect(r.args).toBe('master branch')
      expect(r.stderr).toBe('fatal: ambiguous argument')
    }
  })

  it('returns stderr when only local-command-stderr present', () => {
    const src = `<local-command-stderr>npm ERR! something went wrong</local-command-stderr>`
    const r = classifyUserText(src)
    expect(r.kind).toBe('stderr')
    if (r.kind === 'stderr') expect(r.text).toMatch(/npm ERR/)
  })

  it('empty local-command-stderr falls back to text', () => {
    const src = `<local-command-stderr></local-command-stderr>`
    const r = classifyUserText(src)
    expect(r.kind).toBe('text')
  })
})
