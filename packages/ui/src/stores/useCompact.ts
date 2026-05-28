import { create } from 'zustand'

interface CompactStore {
  compact: boolean
  toggle: () => void
}

/**
 * "Compact mode" — collapses each turn to just the user prompt and the
 * assistant's final answer text (the last text block in the turn's last
 * Request). Thinking blocks, tool calls, tool results, REQ caps and
 * attachments are hidden. Used to scan long sessions for prompt → reply pairs.
 */
export const useCompact = create<CompactStore>((set) => ({
  compact: true,
  toggle: () => set((s) => ({ compact: !s.compact })),
}))
