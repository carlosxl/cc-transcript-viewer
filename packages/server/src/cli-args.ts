// packages/server/src/cli-args.ts
//
// Pure-function CLI arg parser + projects-dir resolver + D-07 message builder.
// No side effects (no process.exit, no console writes) — tests inject argv
// directly and assert the structured return value.
//
// Decisions encoded here:
//   - D-04: flag set is { --port|-p, --no-open, --dir|-d, --help|-h, --version|-v }
//   - D-05: projects-dir precedence is --dir > CC_PROJECTS_DIR > ~/.claude/projects
//   - D-06: default port is 7823
//   - D-07: exact port-conflict message format
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Requested informational print mode. */
export type PrintRequest = 'help' | 'version'

export interface CliArgs {
  /** User-requested port. Undefined → use DEFAULT_PORT. */
  port?: number
  /** True when --no-open (D-04, D-08). */
  noOpen: boolean
  /** User-supplied --dir. Undefined → fall back to env/default. */
  dir?: string
  /** Set when --help or --version. Triggers early return. */
  print?: PrintRequest
}

/** Default port per D-06. */
export const DEFAULT_PORT = 7823

export class CliArgsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CliArgsError'
  }
}

/**
 * Flags per D-04:
 *   --port <n> | -p <n>       Integer in [1, 65535]
 *   --no-open                 Skip browser open (D-08)
 *   --dir <path> | -d <path>  Override ~/.claude/projects
 *   --help | -h               Print usage and exit 0
 *   --version | -v            Print version and exit 0
 */
export function parseCliArgs(argv: readonly string[]): CliArgs {
  const out: CliArgs = { noOpen: false }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!

    switch (token) {
      case '--help':
      case '-h':
        return { noOpen: false, print: 'help' }

      case '--version':
      case '-v':
        return { noOpen: false, print: 'version' }

      case '--port':
      case '-p': {
        const raw = argv[i + 1]
        if (raw === undefined || raw.startsWith('-')) {
          throw new CliArgsError(`${token} requires a value`)
        }
        const n = Number.parseInt(raw, 10)
        // Reject: NaN, non-integer, decimals, out-of-range, weird strings.
        if (!Number.isInteger(n) || n < 1 || n > 65535 || String(n) !== raw) {
          throw new CliArgsError(
            `Invalid --port value: "${raw}" (expected integer 1-65535)`,
          )
        }
        out.port = n
        i++
        break
      }

      case '--no-open':
        out.noOpen = true
        break

      case '--dir':
      case '-d': {
        const raw = argv[i + 1]
        if (raw === undefined || raw.startsWith('-')) {
          throw new CliArgsError(`${token} requires a value`)
        }
        out.dir = raw
        i++
        break
      }

      default:
        throw new CliArgsError(`Unknown flag: ${token}`)
    }
  }

  return out
}

/** ~/.claude/projects — the canonical Claude Code transcript root. */
export function getDefaultProjectsDir(): string {
  return join(homedir(), '.claude', 'projects')
}

/** D-05 precedence: flag > env > default. */
export function resolveProjectsDir(
  args: CliArgs,
  env: Record<string, string | undefined>,
): string {
  if (args.dir && args.dir.length > 0) return args.dir
  const fromEnv = env['CC_PROJECTS_DIR']
  if (fromEnv && fromEnv.length > 0) return fromEnv
  return getDefaultProjectsDir()
}

/**
 * Format the D-07 port-conflict one-liner. Caller writes to stderr and exits 1.
 *
 * Wording is FIXED — the integration test in plan 09 asserts the exact string.
 */
export function portConflictMessage(port: number): string {
  // Suggest a neighbouring port. Edge case: --port 65535 → suggest 65534.
  const next = port === 65535 ? port - 1 : port + 1
  return `Port ${port} is already in use. Try \`npx cc-viewer --port ${next}\` or check if cc-viewer is already running at http://127.0.0.1:${port}`
}

export function helpText(): string {
  return [
    'cc-viewer — local web-UI viewer for Claude Code transcripts',
    '',
    'Usage:',
    '  cc-viewer [--port <n>] [--no-open] [--dir <path>]',
    '',
    'Flags:',
    `  -p, --port <n>     Port to listen on (default ${DEFAULT_PORT})`,
    '      --no-open      Do not open the browser automatically',
    '  -d, --dir <path>   Override Claude Code projects directory',
    '                     (default ~/.claude/projects; env CC_PROJECTS_DIR)',
    '  -h, --help         Print this help and exit',
    '  -v, --version      Print version and exit',
    '',
  ].join('\n')
}
