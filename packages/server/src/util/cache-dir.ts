// packages/server/src/util/cache-dir.ts
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

/**
 * Returns the platform-native cache directory for cc-viewer and ensures it
 * exists with mode 0o700 (owner read/write/execute only — D-13, SYS-04).
 *
 * Mimics `env-paths` behavior without the runtime dependency.
 *
 *   macOS:   ~/Library/Caches/cc-viewer/
 *   Linux:   $XDG_CACHE_HOME/cc-viewer/  (falls back to ~/.cache/cc-viewer/)
 *   Windows: %LOCALAPPDATA%\cc-viewer\Cache   (falls back to ~/AppData/Local/cc-viewer/Cache)
 *
 * On non-POSIX platforms the `mode: 0o700` option is ignored by mkdirSync;
 * Windows ACLs are not enforced here. Acceptable because the tool targets
 * macOS/Linux primarily (CLAUDE.md constraints).
 */
export function getCacheDir(): string {
  let base: string

  if (process.platform === 'darwin') {
    base = join(homedir(), 'Library', 'Caches')
  } else if (process.platform === 'win32') {
    base = process.env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local')
    // Windows adds a trailing "Cache" subdir to distinguish from Roaming.
    const cacheDir = join(base, 'cc-viewer', 'Cache')
    mkdirSync(cacheDir, { recursive: true })
    return cacheDir
  } else {
    base = process.env['XDG_CACHE_HOME'] ?? join(homedir(), '.cache')
  }

  const cacheDir = join(base, 'cc-viewer')
  mkdirSync(cacheDir, { recursive: true, mode: 0o700 })
  return cacheDir
}
