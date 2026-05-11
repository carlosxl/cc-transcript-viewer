// packages/server/src/reader/index.ts
// Public API of the reader module.
// Plans 04/05/06 import from here; internals (parser, normalizer, session-map) are private.

export { parseJSONL, parseLine } from './parser.js'
export type { ParseResult } from './parser.js'
export { eventsToTurns } from './normalizer.js'
export { loadSessionFromDisk } from './session-loader.js'
export type { SessionLoadResult } from './session-loader.js'
export { SessionCache } from './session-cache.js'
export { SessionMap, listSessions } from './session-map.js'
export { watchProjectsDir } from './watcher.js'
