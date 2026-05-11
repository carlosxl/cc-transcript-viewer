// packages/server/src/static.ts
import type { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * MIME type mapping for the manual static handler. Kept in this file so the
 * static-serving surface is a single self-contained module.
 *
 * The list intentionally covers only what the Vite-built UI emits:
 *   - .html, .js, .mjs, .css, .json, .map (sourcemaps when enabled)
 *   - .svg, .png, .ico, .woff, .woff2 — common shadcn/Tailwind v4 assets later
 *
 * Unknown extensions fall through to application/octet-stream — safe default,
 * the browser will not execute it as a script.
 */
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
}

/**
 * Resolve the public directory used to serve the built UI.
 *
 *   In dev (tsx): hereDir = packages/server/src
 *     publicDir = packages/server/src/../public = packages/server/public ✓
 *   In prod (compiled): hereDir = packages/server/dist
 *     publicDir = packages/server/dist/../public = packages/server/public ✓
 *
 * Both paths resolve to the same on-disk directory because copy:ui populates
 * packages/server/public at build time.
 */
function resolvePublicDir(): string {
  const hereDir = dirname(fileURLToPath(import.meta.url))
  return resolve(hereDir, '..', 'public')
}

/**
 * Register the static file handler.
 *
 * Mounted AFTER all /api/* routes in createApp so the SPA never shadows API
 * endpoints. The handler resolves paths under packages/server/public/ — that
 * directory is populated by `npm run copy:ui` during the production build
 * pipeline (see plan 08, root package.json scripts).
 *
 * Behavior:
 *   - If publicDir does NOT exist (developer hasn't built the UI yet, or this
 *     is the in-source dev workflow), register a single GET / handler that
 *     prints a friendly text instructing the developer to run dev:ui or build.
 *     This avoids mysterious 404s and is harmless in tests.
 *   - If publicDir exists, mount a manual file-serving handler that:
 *       * Maps `/` to `/index.html` for SPA root.
 *       * Confines all reads to publicDir via normalize() + startsWith() guard
 *         (T-01-08-01 path-traversal mitigation).
 *       * Sets Content-Type from MIME table; falls back to octet-stream.
 *       * Returns 404 (via app.notFound) for missing files.
 *
 * Why a manual handler instead of @hono/node-server/serve-static:
 *   - serveStatic resolves `root` relative to process.cwd(), which makes the
 *     behavior depend on where the user invoked the binary from. Our public/
 *     lives next to the compiled module, not next to cwd.
 *   - The manual handler is ~25 lines and gives us absolute-path safety,
 *     explicit MIME control, and no surprise traversal behavior.
 *   - serveStatic is still imported above so a future migration is one line.
 *
 * The optional `publicDirOverride` argument exists purely for tests so a test
 * can point at a tmpdir without polluting the real packages/server/public.
 */
export function registerStatic(app: Hono, publicDirOverride?: string): void {
  const publicDir = publicDirOverride ?? resolvePublicDir()

  if (!existsSync(publicDir)) {
    // Dev workflow: no UI built yet. Serve a placeholder at / so the developer
    // sees a clear message instead of a generic 404. Other paths still 404.
    app.get('/', (c) =>
      c.text(
        'cc-viewer server is running.\n\n' +
          'UI is not built. In development, run `npm run dev:ui` and visit http://localhost:5173\n' +
          'In production, this directory should contain the built UI (run `npm run build`).\n',
        200,
      ),
    )
    return
  }

  // Cache the absolute, normalized publicDir for the traversal guard.
  const root = normalize(publicDir)

  // Mount on /* — but explicitly skip /api/* paths so the static handler never
  // shadows API routes (including ones registered later by tests). Hono uses
  // registration order for `app.get` matching, and our /* would otherwise win
  // over any /api/* route added after createApp returns. We use a plain
  // middleware that calls next() for /api/* requests so the API handlers see
  // them, and falls through to the file handler otherwise.
  app.get('/*', async (c, next) => {
    if (c.req.path.startsWith('/api/')) {
      // Let downstream /api/* handlers (or the canonical 404) handle this.
      await next()
      return
    }
    const reqPath = c.req.path === '/' || c.req.path === '' ? '/index.html' : c.req.path
    // join + normalize collapse `..` segments; the startsWith guard then
    // rejects anything that escaped publicDir.
    const target = normalize(join(root, reqPath))
    if (!target.startsWith(root)) {
      // Path traversal attempt. Treat as not-found rather than leaking
      // detail to the client.
      return c.notFound()
    }

    let body: Uint8Array<ArrayBuffer>
    let size: number
    try {
      const st = statSync(target)
      if (!st.isFile()) return c.notFound()
      size = st.size
      // readFileSync returns a Buffer (Uint8Array<ArrayBufferLike>). Hono's
      // c.body() requires Uint8Array<ArrayBuffer> specifically (no Shared-
      // ArrayBuffer variance). Copy the bytes into a freshly-allocated
      // ArrayBuffer so the type narrows correctly.
      const buf = readFileSync(target)
      const ab = new ArrayBuffer(buf.byteLength)
      const view = new Uint8Array(ab)
      view.set(buf)
      body = view
    } catch {
      return c.notFound()
    }

    const type = MIME[extname(target).toLowerCase()] ?? 'application/octet-stream'
    return c.body(body, 200, {
      'Content-Type': type,
      'Content-Length': String(size),
    })
  })
}

// Re-exported so a future migration to the upstream helper is a one-line
// import change rather than a hunt for the symbol.
export { serveStatic }
