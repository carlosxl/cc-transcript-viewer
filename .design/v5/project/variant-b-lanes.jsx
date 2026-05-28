// Variant B — Two-lane timeline.
// Left lane = what the MODEL emitted (thinking, text, tool_use calls).
// Right lane = what the HARNESS returned (tool_results, paired by row).
// A horizontal connector across the gutter shows each call ↔ return pair.

function VB_Card({ block }) {
  if (block.kind === 'thinking') {
    return <div className="vb-card vb-card-think">{block.body}</div>;
  }
  if (block.kind === 'text') {
    return <div className="vb-card vb-card-text">{renderInline(block.body)}</div>;
  }
  if (block.kind === 'tool_use') {
    return (
      <div className="vb-card vb-card-call">
        <div className="vb-card-call-row">
          <span className="dot" />
          <span className="name">{block.name}</span>
          <span className="arg">{toolArg(block)}</span>
        </div>
      </div>
    );
  }
  return null;
}

function VB_Return({ toolUse, diff }) {
  if (!toolUse) {
    // orphan diff (no preceding tool_use)
    return (
      <div className="vb-card vb-card-return">
        <div className="vb-card-return-row">
          <span className="name">diff</span>
          <span className="arg">{diff.path}</span>
        </div>
        <div className="vb-result-body">
          <div className="vb-diff-meta">
            <span>{diff.path}</span>
            <span className="add">+{diff.adds}</span>
            <span className="del">−{diff.dels}</span>
          </div>
          <DiffLines hunks={diff.hunks} dense />
        </div>
      </div>
    );
  }
  return (
    <div className="vb-card vb-card-return">
      <div className="vb-card-return-row">
        <span className="name">{toolUse.name}</span>
        <span className="dur">{fmtDur(toolUse.duration)}</span>
        <span className={'st ' + (toolUse.status === 'err' ? 'err' : 'ok')}>
          {toolUse.status === 'err' ? 'err' : 'ok'}
        </span>
      </div>
      {diff ? (
        <div className="vb-result-body">
          <div className="vb-diff-meta">
            <span>{diff.path}</span>
            <span className="add">+{diff.adds}</span>
            <span className="del">−{diff.dels}</span>
          </div>
          <DiffLines hunks={diff.hunks} dense />
        </div>
      ) : toolUse.preview ? (
        <pre className="vb-preview">{toolUse.preview}</pre>
      ) : null}
    </div>
  );
}

// Walk a request into a sequence of paired rows.
// A row is either {left: block} or {left: tool_use_block, right: {toolUse, diff}}
// or {right: orphanDiff}.
function buildRows(request) {
  const rows = [];
  const consumed = new Set();
  request.blocks.forEach((b, i) => {
    if (consumed.has(i)) return;
    if (b.kind === 'tool_use') {
      const next = request.blocks[i + 1];
      let pairedDiff = null;
      if (next && next.kind === 'diff' && isWriteTool(b.name)) {
        pairedDiff = next;
        consumed.add(i + 1);
      }
      rows.push({ kind: 'pair', left: b, right: { toolUse: b, diff: pairedDiff } });
    } else if (b.kind === 'diff') {
      rows.push({ kind: 'orphan', right: { toolUse: null, diff: b } });
    } else {
      rows.push({ kind: 'solo', left: b });
    }
  });
  return rows;
}

function VB_Request({ request, idx, total }) {
  const rows = buildRows(request);
  const toolCount = rows.filter(r => r.kind === 'pair' || r.kind === 'orphan').length;
  const toolDur = rows.reduce((s, r) => s + (r.right?.toolUse?.duration || 0), 0);

  return (
    <div className="vb-request">
      <div className="vb-req-head">
        <div className="vb-req-head-l">
          <span className="vb-req-arrow">→</span>
          <span className="vb-req-id">REQ {idx + 1}/{total}</span>
          <span className="vb-req-meta">{request.id}</span>
        </div>
        <div className="vb-req-head-r">
          <span>{request.ttft}ms TTFT</span>
          <span>·</span>
          <span>{fmtDur(request.duration)}</span>
          <span>·</span>
          <span>{fmtK(request.tokens.in)} in · {fmtK(request.tokens.out)} out</span>
          <span className="vb-req-cost">{fmtCost(request.cost)}</span>
        </div>
      </div>

      <div className="vb-lanes">
        <div className="vb-lane-labels">
          <span>MODEL EMITS</span>
          <span className="vb-lane-spacer" />
          <span>HARNESS RETURNS</span>
        </div>
        <div className="vb-grid">
          {rows.map((row, i) => (
            <div key={i} className={'vb-row vb-row-' + row.kind}>
              <div className="vb-cell vb-cell-l">
                {row.left ? <VB_Card block={row.left} /> : null}
              </div>
              <div className="vb-cell vb-cell-c">
                {row.kind === 'pair' && (
                  <div className="vb-connector">
                    <span className="vb-conn-line" />
                    <span className="vb-conn-dur">{fmtDur(row.right.toolUse.duration)}</span>
                  </div>
                )}
              </div>
              <div className="vb-cell vb-cell-r">
                {row.right ? <VB_Return toolUse={row.right.toolUse} diff={row.right.diff} /> : null}
              </div>
            </div>
          ))}
        </div>
        {toolCount > 0 && (
          <div className="vb-harness-caption">
            ← harness ran {toolCount} tool {toolCount === 1 ? 'call' : 'calls'} · {fmtDur(toolDur)}
            <span className="trail">→ fed into next request as input</span>
          </div>
        )}
      </div>
    </div>
  );
}

function VB_UserPrompt({ turn }) {
  return (
    <div className="vb-user">
      <div className="vb-user-cap">
        <span>USER</span>
        <span className="vb-user-id">{turn.userMsgId}</span>
        <span className="dot" />
        <span>{turn.time}</span>
      </div>
      <div className="vb-user-body">{turn.prompt}</div>
    </div>
  );
}

function VariantB() {
  const { t4, t7 } = getSlice();
  return (
    <div className="variant variant-b">
      {[t4, t7].map(turn => (
        <div key={turn.id} className="vb-turn">
          <div className="vb-turn-divider">
            <span className="vb-turn-pill">{`Turn ${turn.id.replace('T', '')}`}</span>
            <span className="vb-turn-time">{turn.time}</span>
            <span className="vb-turn-cost">{fmtCost(turn.requests.reduce((s, r) => s + r.cost, 0))}</span>
            <span className="vb-turn-rule" />
          </div>
          <VB_UserPrompt turn={turn} />
          {turn.requests.map((r, i) => <VB_Request key={r.id} request={r} idx={i} total={turn.requests.length} />)}
        </div>
      ))}
    </div>
  );
}

window.VariantB = VariantB;
