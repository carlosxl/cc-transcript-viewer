import type { HighlighterCore } from 'shiki/core'
import { createHighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import vitesseDark from '@shikijs/themes/vitesse-dark'
import vitesseLight from '@shikijs/themes/vitesse-light'

const SUPPORTED = ['typescript', 'javascript', 'python', 'bash', 'json', 'yaml', 'markdown'] as const
export type Lang = typeof SUPPORTED[number] | 'plaintext'
export type Theme = 'vitesse-dark' | 'vitesse-light'

let highlighterPromise: Promise<HighlighterCore> | null = null
let _initCount = 0   // test-only instrumentation; safe to expose

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    _initCount++
    highlighterPromise = createHighlighterCore({
      themes: [vitesseDark, vitesseLight],
      langs: [
        () => import('@shikijs/langs/typescript'),
        () => import('@shikijs/langs/javascript'),
        () => import('@shikijs/langs/python'),
        () => import('@shikijs/langs/bash'),
        () => import('@shikijs/langs/json'),
        () => import('@shikijs/langs/yaml'),
        () => import('@shikijs/langs/markdown'),
      ],
      engine: createOnigurumaEngine(import('shiki/wasm')),
    })
  }
  return highlighterPromise
}

export function normalizeLang(lang: string): Lang {
  return (SUPPORTED as readonly string[]).includes(lang) ? (lang as Lang) : 'plaintext'
}

export async function highlight(code: string, lang: string, theme: Theme): Promise<string> {
  const h = await getHighlighter()
  return h.codeToHtml(code, { lang: normalizeLang(lang), theme })
}

// Test-only: read+reset the singleton init count. Do not import in production code.
export function __getInitCount(): number { return _initCount }
export function __resetForTest(): void { highlighterPromise = null; _initCount = 0 }
