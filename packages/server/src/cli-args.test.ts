import { describe, it, expect } from 'vitest'
import {
  parseCliArgs,
  CliArgsError,
  getDefaultProjectsDir,
  resolveProjectsDir,
  portConflictMessage,
  DEFAULT_PORT,
} from './cli-args.js'

describe('parseCliArgs', () => {
  it('parses empty argv to defaults', () => {
    expect(parseCliArgs([])).toEqual({ noOpen: false })
  })

  it('parses --port / -p with integer value', () => {
    expect(parseCliArgs(['--port', '7900']).port).toBe(7900)
    expect(parseCliArgs(['-p', '7900']).port).toBe(7900)
  })

  it('rejects non-numeric --port', () => {
    expect(() => parseCliArgs(['--port', 'xyz'])).toThrow(CliArgsError)
  })

  it('rejects decimal --port (integer only)', () => {
    expect(() => parseCliArgs(['--port', '7900.5'])).toThrow(CliArgsError)
  })

  it('rejects out-of-range --port', () => {
    expect(() => parseCliArgs(['--port', '0'])).toThrow(CliArgsError)
    expect(() => parseCliArgs(['--port', '65536'])).toThrow(CliArgsError)
    expect(() => parseCliArgs(['--port', '-1'])).toThrow(CliArgsError)
  })

  it('rejects --port with missing value', () => {
    expect(() => parseCliArgs(['--port'])).toThrow(CliArgsError)
    // next token is a flag → still a missing value
    expect(() => parseCliArgs(['--port', '--dir', '/tmp'])).toThrow(CliArgsError)
  })

  it('parses --no-open', () => {
    expect(parseCliArgs(['--no-open']).noOpen).toBe(true)
  })

  it('parses --dir / -d', () => {
    expect(parseCliArgs(['--dir', '/tmp/x']).dir).toBe('/tmp/x')
    expect(parseCliArgs(['-d', '/tmp/x']).dir).toBe('/tmp/x')
  })

  it('returns print:help for --help / -h', () => {
    expect(parseCliArgs(['--help']).print).toBe('help')
    expect(parseCliArgs(['-h']).print).toBe('help')
  })

  it('returns print:version for --version / -v', () => {
    expect(parseCliArgs(['--version']).print).toBe('version')
    expect(parseCliArgs(['-v']).print).toBe('version')
  })

  it('rejects unknown flags', () => {
    expect(() => parseCliArgs(['--nonsense'])).toThrow(CliArgsError)
  })

  it('parses multiple flags in one invocation', () => {
    const a = parseCliArgs(['--port', '7900', '--no-open', '--dir', '/tmp/x'])
    expect(a).toEqual({ port: 7900, noOpen: true, dir: '/tmp/x' })
  })
})

describe('resolveProjectsDir (D-05)', () => {
  it('flag wins over env', () => {
    expect(
      resolveProjectsDir({ noOpen: false, dir: '/a' }, { CC_PROJECTS_DIR: '/b' }),
    ).toBe('/a')
  })
  it('env used when flag absent', () => {
    expect(resolveProjectsDir({ noOpen: false }, { CC_PROJECTS_DIR: '/b' })).toBe('/b')
  })
  it('default used when both absent', () => {
    expect(resolveProjectsDir({ noOpen: false }, {})).toBe(getDefaultProjectsDir())
  })
  it('empty env value falls through to default', () => {
    expect(resolveProjectsDir({ noOpen: false }, { CC_PROJECTS_DIR: '' })).toBe(
      getDefaultProjectsDir(),
    )
  })
})

describe('portConflictMessage (D-07)', () => {
  it('uses exact D-07 wording', () => {
    const msg = portConflictMessage(7823)
    expect(msg).toBe(
      'Port 7823 is already in use. Try `npx cc-viewer --port 7824` or check if cc-viewer is already running at http://127.0.0.1:7823',
    )
  })
})

describe('DEFAULT_PORT (D-06)', () => {
  it('is 7823', () => {
    expect(DEFAULT_PORT).toBe(7823)
  })
})
