// packages/server/src/cli.ts
//
// CLI main() entry point — consumed by both `tsx packages/server/src/cli.ts`
// in dev and `bin/cc-viewer.js` (the hand-authored shim) at runtime.
//
// main() is testable via dependency injection: callers may override
// startServerImpl, openImpl, stdout/stderr streams, env, argv, and signal
// handler installation. The integration test takes advantage of all of these.
//
// Decisions encoded:
//   - D-04 flags via parseCliArgs
//   - D-05 projectsDir precedence via resolveProjectsDir
//   - D-06 DEFAULT_PORT fallback when --port absent
//   - D-07 portConflictMessage on EADDRINUSE (err.code === 'EADDRINUSE')
//   - D-08 browser-open skip conditions: --no-open OR CI truthy OR !stdout.isTTY
import process from 'node:process'
import open from 'open'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { startServer, type ServerHandle } from './index.js'
import {
  parseCliArgs,
  CliArgsError,
  DEFAULT_PORT,
  resolveProjectsDir,
  portConflictMessage,
  helpText,
} from './cli-args.js'

interface PkgJson { version?: string }

/**
 * Read `version` from the nearest enclosing package.json. The compiled file
 * lives at `packages/server/dist/cli.js`; the published manifest is the repo
 * root package.json (../../../package.json relative to dist/cli.js). Source
 * runs under tsx land at `packages/server/src/cli.ts` (also ../../.. away).
 * Try sensible candidates and return the first version we find.
 */
async function readPackageVersion(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    resolve(here, '..', '..', '..', 'package.json'),  // repo root
    resolve(here, '..', '..', 'package.json'),        // packages/server/package.json
    resolve(here, '..', 'package.json'),              // (defensive — unlikely)
  ]
  for (const candidate of candidates) {
    try {
      const j = JSON.parse(await readFile(candidate, 'utf8')) as PkgJson
      if (j.version) return j.version
    } catch {
      // try next candidate
    }
  }
  return '0.0.0'
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && typeof (err as { code?: unknown }).code === 'string'
}

export interface MainOptions {
  argv?: readonly string[]
  env?: Record<string, string | undefined>
  /** Injection point for tests — defaults to real startServer. */
  startServerImpl?: typeof startServer
  /** Injection point for tests — defaults to real `open()`. */
  openImpl?: (url: string) => Promise<unknown>
  /** Set false in tests so SIGINT/SIGTERM handlers are not registered. */
  installSignalHandlers?: boolean
  /** Stream to write user-facing messages to. Defaults to process.stdout. */
  stdout?: NodeJS.WriteStream
  stderr?: NodeJS.WriteStream
}

export interface MainResult {
  /** Exit code the caller should apply (0 success, 1 error). */
  code: number
  /**
   * The live ServerHandle, present iff the server actually started. Used by
   * the integration test to close the server cleanly. The bin shim ignores it
   * and lets SIGINT drive shutdown.
   */
  handle?: ServerHandle
}

/**
 * main() — CLI entry point.
 *
 * On success returns `{ code: 0, handle }` AFTER the server has bound — the
 * promise resolves immediately so the bin shim can fall through to its
 * "process stays alive until signal" behaviour. The returned handle is for
 * tests; the bin shim never reads it.
 *
 * On error returns `{ code: 1 }` (no handle). The caller is expected to exit
 * with the returned code.
 */
export async function main(opts: MainOptions = {}): Promise<MainResult> {
  const argv = opts.argv ?? process.argv.slice(2)
  const env = opts.env ?? process.env
  const stdout = opts.stdout ?? process.stdout
  const stderr = opts.stderr ?? process.stderr
  const startImpl = opts.startServerImpl ?? startServer
  const openImpl = opts.openImpl ?? ((url: string) => open(url))

  // Parse args — any error here is user-facing.
  let args: ReturnType<typeof parseCliArgs>
  try {
    args = parseCliArgs(argv)
  } catch (err) {
    if (err instanceof CliArgsError) {
      stderr.write(`cc-viewer: ${err.message}\n\n${helpText()}`)
      return { code: 1 }
    }
    throw err
  }

  // Early returns for --help / --version
  if (args.print === 'help') {
    stdout.write(helpText())
    return { code: 0 }
  }
  if (args.print === 'version') {
    const v = await readPackageVersion()
    stdout.write(`${v}\n`)
    return { code: 0 }
  }

  const port = args.port ?? DEFAULT_PORT
  const projectsDir = resolveProjectsDir(args, env)

  let handle: ServerHandle
  try {
    handle = await startImpl({ port, projectsDir, env: env['NODE_ENV'] })
  } catch (err) {
    if (isErrnoException(err) && err.code === 'EADDRINUSE') {
      stderr.write(portConflictMessage(port) + '\n')
      return { code: 1 }
    }
    stderr.write(
      `cc-viewer: failed to start server: ${err instanceof Error ? err.message : String(err)}\n`,
    )
    return { code: 1 }
  }

  const url = `http://127.0.0.1:${handle.port}`
  stdout.write(`cc-viewer running at ${url}\n`)

  // D-08: skip browser-open when --no-open OR CI truthy OR stdout not a TTY.
  const shouldOpen = !args.noOpen && !env['CI'] && Boolean(stdout.isTTY)
  if (shouldOpen) {
    openImpl(url).catch(() => {
      stderr.write(
        `cc-viewer: could not open browser automatically. Visit ${url}\n`,
      )
    })
  }

  if (opts.installSignalHandlers !== false) {
    let shuttingDown = false
    const shutdown = async (): Promise<void> => {
      if (shuttingDown) return
      shuttingDown = true
      try {
        await handle.close()
      } catch (err) {
        stderr.write(
          `cc-viewer: error during shutdown: ${err instanceof Error ? err.message : String(err)}\n`,
        )
      }
      process.exit(0)
    }
    process.once('SIGINT', () => void shutdown())
    process.once('SIGTERM', () => void shutdown())
  }

  return { code: 0, handle }
}
