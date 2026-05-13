import type { LucideIcon } from 'lucide-react'
import {
  Terminal,
  Pencil,
  Wrench,
  Search,
  Globe,
  Sparkles,
  FileText,
} from 'lucide-react'

/**
 * Maps Claude Code tool names to their lucide-react icon. Shared by the
 * inline ToolCapsule and the Inspector rail's ToolHeader so both render the
 * same visual for a given tool.
 *
 * Unknown tools fall back to a generic wrench (see `iconFor`).
 */
export const TOOL_ICONS: Record<string, LucideIcon> = {
  Bash: Terminal,
  Read: FileText,
  Glob: Search,
  Grep: Search,
  WebFetch: Globe,
  WebSearch: Globe,
  Edit: Pencil,
  Write: Pencil,
  MultiEdit: Pencil,
  NotebookEdit: Pencil,
  Task: Sparkles,
  Agent: Sparkles,
}

export function iconFor(tool: string): LucideIcon {
  return TOOL_ICONS[tool] ?? Wrench
}
