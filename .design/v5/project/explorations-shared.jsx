// Shared helpers + slice extraction for the three transcript explorations.

const fmtCost = (c) => '$' + (c || 0).toFixed(2);
const fmtK = (n) => {
  if (n == null) return '—';
  if (n < 1000) return String(n);
  return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
};
const fmtDur = (ms) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`;

// Tool arg summary: the one thing worth showing inline.
function toolArg(b) {
  if (!b.input) return '';
  if (b.name === 'Bash') return b.input.command || '';
  if (b.name === 'Read' || b.name === 'Write' || b.name === 'Edit' || b.name === 'MultiEdit') return b.input.path || '';
  if (b.name === 'Grep') return `"${b.input.pattern}"${b.input.path ? ` in ${b.input.path}` : ''}`;
  if (b.name === 'Glob') return b.input.pattern || '';
  return Object.keys(b.input).slice(0, 2).map(k => `${k}=${JSON.stringify(b.input[k]).slice(0, 24)}`).join(' · ');
}

// Light inline markdown (only **bold** + `code`)
function renderInline(s) {
  if (!s) return null;
  const lines = s.split('\n');
  return lines.map((line, li) => {
    const parts = [];
    let i = 0, key = 0;
    while (i < line.length) {
      if (line.startsWith('**', i)) {
        const end = line.indexOf('**', i + 2);
        if (end !== -1) { parts.push(<strong key={key++}>{line.slice(i + 2, end)}</strong>); i = end + 2; continue; }
      }
      if (line[i] === '`') {
        const end = line.indexOf('`', i + 1);
        if (end !== -1) { parts.push(<code key={key++}>{line.slice(i + 1, end)}</code>); i = end + 1; continue; }
      }
      let next = line.length;
      const a = line.indexOf('**', i + 1); if (a !== -1 && a < next) next = a;
      const b = line.indexOf('`', i + 1); if (b !== -1 && b < next) next = b;
      parts.push(<span key={key++}>{line.slice(i, next)}</span>);
      i = next;
    }
    return <React.Fragment key={li}>{parts}{li < lines.length - 1 && <br />}</React.Fragment>;
  });
}

// Pair tool_use ↔ following Edit/Write/MultiEdit diff into one harness result.
const isWriteTool = (n) => n === 'Edit' || n === 'Write' || n === 'MultiEdit';

function splitRequest(request) {
  const assistantBlocks = [];   // {block, idx}
  const harnessResults = [];    // {toolUse, diff, idx}
  const consumed = new Set();
  request.blocks.forEach((b, i) => {
    if (consumed.has(i)) return;
    if (b.kind === 'tool_use') {
      assistantBlocks.push({ block: b, idx: i });
      const next = request.blocks[i + 1];
      let pairedDiff = null;
      if (next && next.kind === 'diff' && isWriteTool(b.name)) {
        pairedDiff = next;
        consumed.add(i + 1);
      }
      harnessResults.push({ toolUse: b, diff: pairedDiff, idx: i });
    } else if (b.kind === 'diff') {
      harnessResults.push({ toolUse: null, diff: b, idx: i, orphan: true });
    } else {
      assistantBlocks.push({ block: b, idx: i });
    }
  });
  return { assistantBlocks, harnessResults };
}

// Pull just the slices the brief asks for.
function getSlice() {
  const session = window.SAMPLE.activeSession;
  const t4 = session.turns.find(t => t.id === 'T4');
  const t7 = session.turns.find(t => t.id === 'T7');
  return { t4, t7 };
}

// Shared diff-line renderer. Compact 2-gutter grid.
function DiffLines({ hunks, dense = false }) {
  return (
    <div className={'shared-diff-body' + (dense ? ' dense' : '')}>
      {hunks.map((h, i) => {
        if (h.type === 'hunk') {
          return <div key={i} className="sdl hunk">{h.text}</div>;
        }
        const cls = h.type === 'add' ? 'add' : h.type === 'del' ? 'del' : 'ctx';
        const sym = h.type === 'add' ? '+' : h.type === 'del' ? '−' : ' ';
        return (
          <div key={i} className={'sdl ' + cls}>
            <span className="ln">{h.n || ''}</span>
            <span className="mk">{sym}</span>
            <span className="src">{h.text}</span>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  fmtCost, fmtK, fmtDur, toolArg, renderInline, splitRequest, getSlice, isWriteTool, DiffLines,
});
