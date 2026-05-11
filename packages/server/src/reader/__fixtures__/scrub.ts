#!/usr/bin/env tsx
/**
 * Usage: npx tsx packages/server/src/reader/__fixtures__/scrub.ts \
 *        ~/.claude/projects/<slug>/<session>.jsonl \
 *        packages/server/src/reader/__fixtures__/real/<session>.jsonl
 *
 * One-shot developer tool. NOT part of the build pipeline. Not invoked in CI.
 * Developers MUST manually inspect output before committing.
 *
 * Implements D-31 scrubbing: API keys, bearer tokens, absolute home-dir paths,
 * common secret JSON fields.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'

const home = homedir()
const homeEscaped = home.replace(/[/\\]/g, '[/\\\\]')

const SCRUB_PATTERNS: Array<[RegExp, string]> = [
  [/sk-ant-[a-zA-Z0-9\-_]{40,}/g, 'sk-ant-REDACTED'],
  [/sk-[a-zA-Z0-9]{40,}/g, 'sk-REDACTED'],
  [/Bearer [a-zA-Z0-9\-_.~+/]+=*/g, 'Bearer REDACTED'],
  [new RegExp(homeEscaped, 'g'), '/home/USER'],
  [/"password"\s*:\s*"[^"]+"/g, '"password":"REDACTED"'],
  [/"token"\s*:\s*"[^"]+"/g, '"token":"REDACTED"'],
  [/"api_key"\s*:\s*"[^"]+"/g, '"api_key":"REDACTED"'],
  [/"secret"\s*:\s*"[^"]+"/g, '"secret":"REDACTED"'],
]

const [, , inputPath, outputPath] = process.argv
if (!inputPath || !outputPath) {
  console.error('Usage: scrub.ts <input.jsonl> <output.jsonl>')
  process.exit(1)
}

let content = readFileSync(inputPath, 'utf8')
for (const [pattern, replacement] of SCRUB_PATTERNS) {
  content = content.replace(pattern, replacement)
}
writeFileSync(outputPath, content, 'utf8')
console.error(`Scrubbed ${inputPath} → ${outputPath}`)
console.error('REMINDER: manually inspect output before committing. Check for residual paths, API keys, or proprietary content.')
