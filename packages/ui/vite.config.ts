// packages/ui/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/**
 * Vite dev server setup:
 *   - React plugin for Fast Refresh
 *   - Tailwind CSS v4 via @tailwindcss/vite plugin (no tailwind.config.js)
 *   - @/ path alias for src/
 *   - Dev-time /api/* proxy to the Hono server running on 127.0.0.1:7823
 *   - changeOrigin: false — keep the browser's Origin header intact so the
 *     server's allowlist (which includes http://localhost:5173 in dev) passes
 *     the D-11 origin check. Setting true would rewrite Origin to the target
 *     and mask real DNS-rebinding protection bugs (RESEARCH.md Pitfall 5).
 */
export default defineConfig({
  // Pin root to packages/ui/ so `vite build --config packages/ui/vite.config.ts`
  // from the repo root resolves index.html / src/ correctly. Without this Vite
  // uses cwd, which breaks the root-level `npm run build:ui` script.
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@cc-viewer/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:7823',
        changeOrigin: false,  // PRESERVE — Phase 1 D-11 / Pitfall 5 dependency
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: { inlineDynamicImports: true },  // PRESERVE — Phase 1 plan-08 single-bundle output
    },
  },
})
