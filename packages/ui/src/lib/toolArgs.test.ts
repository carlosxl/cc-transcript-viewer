import { describe, it, expect } from 'vitest'
import { getToolArgSummary } from './toolArgs'

describe('getToolArgSummary', () => {
  it('Bash → command', () => {
    expect(getToolArgSummary('Bash', { command: 'ls -la' })).toBe('ls -la')
  })

  it('Read / Write / Edit / MultiEdit / NotebookEdit → file_path with path/notebook_path fallbacks', () => {
    expect(getToolArgSummary('Read', { file_path: '/a.ts' })).toBe('/a.ts')
    expect(getToolArgSummary('Write', { path: '/b.ts' })).toBe('/b.ts')
    expect(getToolArgSummary('Edit', { file_path: '/c.ts', path: '/ignored.ts' })).toBe('/c.ts')
    expect(getToolArgSummary('MultiEdit', { file_path: '/d.ts' })).toBe('/d.ts')
    expect(getToolArgSummary('NotebookEdit', { notebook_path: '/nb.ipynb' })).toBe('/nb.ipynb')
  })

  it('Grep → "pattern" (and " in path" when provided)', () => {
    expect(getToolArgSummary('Grep', { pattern: 'foo' })).toBe('"foo"')
    expect(getToolArgSummary('Grep', { pattern: 'foo', path: 'src' })).toBe('"foo" in src')
  })

  it('Glob → pattern', () => {
    expect(getToolArgSummary('Glob', { pattern: '**/*.ts' })).toBe('**/*.ts')
  })

  it('Agent / Task → description', () => {
    expect(getToolArgSummary('Agent', { description: 'do thing' })).toBe('do thing')
    expect(getToolArgSummary('Task', { description: 'subagent run' })).toBe('subagent run')
  })

  it('unknown tool → joins first two keys as key=value snippets', () => {
    const out = getToolArgSummary('Unknown', { foo: 'aaa', bar: 'bbb', baz: 'ccc' })
    expect(out.startsWith('foo=aaa')).toBe(true)
    expect(out).toContain('bar=bbb')
    expect(out).not.toContain('baz')
  })

  it('handles missing / null input safely', () => {
    expect(getToolArgSummary('Bash', null)).toBe('')
    expect(getToolArgSummary('Bash', undefined)).toBe('')
  })
})
