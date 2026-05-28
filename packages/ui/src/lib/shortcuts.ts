/**
 * Authoritative keyboard-shortcut table per FR-080.
 *
 * Used by useKeyboard (action wiring) and StatusBar (hint chips, FR-081).
 * The display strings here are what the status bar shows; the actual key
 * matching lives in useKeyboard against e.key / e.code.
 */

export type ShortcutGroup = 'navigate' | 'overlay' | 'view'

export interface Shortcut {
  id: ShortcutId
  /** human-readable label shown in status bar / overlays */
  label: string
  /** display strings rendered as kbd chips */
  keys: string[]
  group: ShortcutGroup
}

export type ShortcutId =
  | 'step-node-next'
  | 'step-node-prev'
  | 'step-turn-next'
  | 'step-turn-prev'
  | 'step-prompt-next'
  | 'step-prompt-prev'
  | 'step-tool-next'
  | 'step-tool-prev'
  | 'top'
  | 'bottom'
  | 'page-down'
  | 'page-up'
  | 'jumper'
  | 'search'
  | 'search-slash'
  | 'report'
  | 'theme'
  | 'close'

export const SHORTCUTS: Record<ShortcutId, Shortcut> = {
  'step-node-next':   { id: 'step-node-next',   label: 'step',     keys: ['j', 'k'],     group: 'navigate' },
  'step-node-prev':   { id: 'step-node-prev',   label: 'step back', keys: ['k'],         group: 'navigate' },
  'step-turn-next':   { id: 'step-turn-next',   label: 'turn',     keys: ['⇧J', '⇧K'],   group: 'navigate' },
  'step-turn-prev':   { id: 'step-turn-prev',   label: 'prev turn', keys: ['⇧K'],        group: 'navigate' },
  'step-prompt-next': { id: 'step-prompt-next', label: 'prompt',   keys: ['n'],          group: 'navigate' },
  'step-prompt-prev': { id: 'step-prompt-prev', label: 'prev prompt', keys: ['⇧N'],      group: 'navigate' },
  'step-tool-next':   { id: 'step-tool-next',   label: 'tool',     keys: ['[', ']'],     group: 'navigate' },
  'step-tool-prev':   { id: 'step-tool-prev',   label: 'prev tool', keys: ['['],         group: 'navigate' },
  'top':              { id: 'top',              label: 'top',      keys: ['g', 'g'],     group: 'navigate' },
  'bottom':           { id: 'bottom',           label: 'tail',     keys: ['⇧G'],         group: 'navigate' },
  'page-down':        { id: 'page-down',        label: 'page',     keys: ['Space'],      group: 'navigate' },
  'page-up':          { id: 'page-up',          label: 'page up',  keys: ['⇧Space'],     group: 'navigate' },
  'jumper':           { id: 'jumper',           label: 'turns',    keys: ['⇧T'],         group: 'overlay'  },
  'search':           { id: 'search',           label: 'search',   keys: ['⌘K'],         group: 'overlay'  },
  'search-slash':     { id: 'search-slash',     label: 'search',   keys: ['/'],          group: 'overlay'  },
  'report':           { id: 'report',           label: 'report',   keys: ['r'],          group: 'overlay'  },
  'theme':            { id: 'theme',            label: 'theme',    keys: ['t'],          group: 'view'     },
  'close':            { id: 'close',            label: 'close',    keys: ['Esc'],        group: 'overlay'  },
}

/**
 * Status bar hint chips, in display order. Mirrors the design's status row:
 * j/k step · ⇧J/⇧K turn · n prompt · [ ] tool · T turns · r report · ⌘K search · ⇧G tail · t theme.
 */
export const STATUS_HINTS: { keys: string[]; label: string }[] = [
  { keys: ['j', 'k'],   label: 'step' },
  { keys: ['⇧J', '⇧K'], label: 'turn' },
  { keys: ['n'],         label: 'prompt' },
  { keys: ['[', ']'],   label: 'tool' },
  { keys: ['⇧T'],        label: 'turns' },
  { keys: ['r'],         label: 'report' },
  { keys: ['⌘K'],        label: 'search' },
  { keys: ['⇧G'],        label: 'tail' },
  { keys: ['t'],         label: 'theme' },
]
