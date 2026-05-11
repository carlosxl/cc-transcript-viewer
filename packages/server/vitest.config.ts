import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // D-12 / SYS-03: every test runs through this setup file which patches
    // globalThis.fetch + http.request + https.request to throw on any
    // non-localhost destination. Added in plan 09.
    setupFiles: ['./test/setup-network-guard.ts'],
  },
  resolve: {
    alias: {
      '@cc-viewer/shared': new URL('../shared/src/index.ts', import.meta.url).pathname,
    },
  },
})
