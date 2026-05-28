/**
 * Renders Edit / Write / MultiFile structured patches from the toolUseResult
 * sidecar (007-ui-information-revamp, T024). Lines in `StructuredPatchHunk` are
 * already prefixed with a space / `+` / `-` per the schema.
 *
 * Standalone for now — wired into BlockToolResult's structured-sidecar tab in a
 * follow-up integration task.
 */
import type { StructuredPatchHunk } from '@cc-viewer/shared'

interface PerFile {
  filePath: string
  structuredPatch: StructuredPatchHunk[]
}

interface BlockStructuredPatchProps {
  /** Single-file mode (Edit / Write). */
  filePath?: string
  structuredPatch?: StructuredPatchHunk[]
  /** Multi-file mode (MultiEdit / NotebookEdit). When set, takes precedence. */
  perFile?: PerFile[]
}

export function BlockStructuredPatch(props: BlockStructuredPatchProps) {
  const files = props.perFile && props.perFile.length > 0
    ? props.perFile
    : (props.filePath && props.structuredPatch)
      ? [{ filePath: props.filePath, structuredPatch: props.structuredPatch }]
      : []

  if (files.length === 0) return null

  return (
    <div className="va-structured-patch">
      {files.map((f, i) => (
        <FileHunks key={i} filePath={f.filePath} hunks={f.structuredPatch} />
      ))}
    </div>
  )
}

function FileHunks({ filePath, hunks }: { filePath: string; hunks: StructuredPatchHunk[] }) {
  const totals = countAddsRemoves(hunks)
  return (
    <div className="va-diff">
      <div className="va-diff-meta">
        <span className="path">{filePath}</span>
        <span className="add" style={{ marginLeft: 'auto' }}>+{totals.adds}</span>
        <span className="del">−{totals.dels}</span>
      </div>
      <div className="shared-diff-body dense">
        {hunks.map((h, i) => (
          <Hunk key={i} hunk={h} />
        ))}
      </div>
    </div>
  )
}

function Hunk({ hunk }: { hunk: StructuredPatchHunk }) {
  // Schema shape: { oldStart, oldLines, newStart, newLines, lines: string[] }
  const header = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
  let oldLn = hunk.oldStart
  let newLn = hunk.newStart
  return (
    <>
      <div className="sdl hunk">{header}</div>
      {hunk.lines.map((line, i) => {
        const sym = line.charAt(0)
        const body = line.slice(1)
        let cls: 'add' | 'del' | 'ctx' = 'ctx'
        let lnLabel = ''
        if (sym === '+') {
          cls = 'add'
          lnLabel = String(newLn++)
        } else if (sym === '-') {
          cls = 'del'
          lnLabel = String(oldLn++)
        } else {
          lnLabel = String(newLn)
          oldLn++
          newLn++
        }
        const display = sym === '+' || sym === '-' || sym === ' ' ? sym : ' '
        return (
          <div key={i} className={`sdl ${cls}`}>
            <span className="ln">{lnLabel}</span>
            <span className="mk">{display === '-' ? '−' : display}</span>
            <span className="src">{body}</span>
          </div>
        )
      })}
    </>
  )
}

function countAddsRemoves(hunks: StructuredPatchHunk[]): { adds: number; dels: number } {
  let adds = 0
  let dels = 0
  for (const h of hunks) {
    for (const line of h.lines) {
      if (line.startsWith('+')) adds++
      else if (line.startsWith('-')) dels++
    }
  }
  return { adds, dels }
}
