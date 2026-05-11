import { main } from './cli.js'

main()
  .then((result) => {
    if (result.code !== 0) process.exit(result.code)
  })
  .catch((err) => {
    console.error('cc-viewer dev: unexpected error:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
