/**
 * Tool argument summary for the design's tool-capsule label.
 *
 * Per research.md R-04 the rules are:
 *   Bash                          → input.command
 *   Read/Write/Edit/MultiEdit     → input.file_path ?? input.path
 *   Grep                          → "${pattern}"${ in path?}
 *   Glob                          → input.pattern
 *   Agent / Task                  → input.description
 *   otherwise                     → first two Object.keys joined
 */

function asStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

/**
 * Tool-name display formatting.
 *  - MCP tool names of the form `mcp__<plugin>_<provider>__<action>` are
 *    collapsed to `<provider> · <action>` so the capsule reads at a glance.
 *  - `ExitPlanMode` is relabelled "Plan accepted" since the tool is the
 *    moment the user accepts a plan and reads better that way.
 *  - Everything else returns unchanged.
 */
export function formatToolDisplayName(name: string): string {
  if (name === 'ExitPlanMode') return 'Plan accepted'
  if (name.startsWith('mcp__')) {
    const parts = name.split('__').filter(Boolean)
    if (parts.length >= 2) {
      const provider = parts[parts.length - 2]
      const action = parts[parts.length - 1]
      const providerShort = provider.replace(/^plugin_/, '').split('_').pop() ?? provider
      return `${providerShort} · ${action}`
    }
  }
  return name
}

export function getToolArgSummary(name: string, input: Record<string, unknown> | null | undefined): string {
  const inp = (input ?? {}) as Record<string, unknown>
  switch (name) {
    case 'Bash':
      return asStr(inp.command)
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return asStr(inp.file_path ?? inp.path ?? inp.notebook_path)
    case 'Grep': {
      const pattern = asStr(inp.pattern)
      const path = inp.path ? ` in ${asStr(inp.path)}` : ''
      return `"${pattern}"${path}`
    }
    case 'Glob':
      return asStr(inp.pattern)
    case 'Agent':
    case 'Task':
      return asStr(inp.description)
    default: {
      const keys = Object.keys(inp).slice(0, 2)
      return keys
        .map((k) => `${k}=${asStr(inp[k]).slice(0, 24)}`)
        .join(' ')
    }
  }
}
