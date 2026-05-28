// Variant C — Document / chat-like.
// The transcript reads as long-form prose. Tool calls are one-liners; harness
// returns are inline below each call. Request boundaries are hairlines with a
// gutter marker. Metadata moves to the gutter (visible on hover).

function VC_Thinking({ block }) {
  return (
    <div className="vc-think">
      <div className="vc-think-rail" />
      <div className="vc-think-body">{block.body}</div>
    </div>
  );
}

function VC_Text({ block }) {
  return <div className="vc-text">{renderInline(block.body)}</div>;
}

function VC_Inline({ toolUse, diff }) {
  const verb = ({
    Edit: 'Edited', Write: 'Wrote', MultiEdit: 'Edited',
    Read: 'Read', Bash: 'Ran', Grep: 'Searched', Glob: 'Globbed', Agent: 'Spawned',
  })[toolUse.name] || toolUse.name;
  const arg = toolArg(toolUse);
  const dur = fmtDur(toolUse.duration);
  return (
    <div className="vc-inline">
      <div className="vc-inline-row">
        <span className="vc-inline-glyph">⊕</span>
        <span className="vc-inline-verb">{verb}</span>
        <span className="vc-inline-arg">{arg}</span>
        <span className="vc-inline-dot">·</span>
        <span className="vc-inline-dur">{dur}</span>
        {toolUse.status === 'err' && <span className="vc-inline-err">error</span>}
      </div>
      {diff && (
        <div className="vc-diff">
          <DiffLines hunks={diff.hunks} dense />
          <div className="vc-diff-foot">
            <span className="add">+{diff.adds}</span>
            <span className="del">−{diff.dels}</span>
            <span className="vc-diff-path">{diff.path}</span>
          </div>
        </div>
      )}
      {!diff && toolUse.preview && (
        <pre className="vc-preview">{toolUse.preview}</pre>
      )}
    </div>
  );
}

function VC_Request({ request, idx, total }) {
  // Render each block in source order. tool_use blocks consume their following
  // Edit/Write diff for inline rendering — preserving the conceptual model.
  const items = [];
  const consumed = new Set();
  request.blocks.forEach((b, i) => {
    if (consumed.has(i)) return;
    if (b.kind === 'thinking') items.push({ k: 'think', b, i });
    else if (b.kind === 'text') items.push({ k: 'text', b, i });
    else if (b.kind === 'tool_use') {
      const next = request.blocks[i + 1];
      let pairedDiff = null;
      if (next && next.kind === 'diff' && isWriteTool(b.name)) {
        pairedDiff = next;
        consumed.add(i + 1);
      }
      items.push({ k: 'tool', toolUse: b, diff: pairedDiff, i });
    } else if (b.kind === 'diff') {
      items.push({ k: 'orphan', diff: b, i });
    }
  });

  return (
    <div className="vc-req">
      <div className="vc-req-divider">
        <div className="vc-req-gutter" title={`${request.id} · ${fmtDur(request.duration)} · ${fmtCost(request.cost)}`}>
          <span className="vc-req-mark">◇</span>
          <span className="vc-req-num">REQ {idx + 1}/{total}</span>
        </div>
        <div className="vc-req-rule" />
        <div className="vc-req-meta">
          <span>{request.id}</span>
          <span className="vc-sep">·</span>
          <span>{fmtDur(request.duration)}</span>
          <span className="vc-sep">·</span>
          <span>{fmtCost(request.cost)}</span>
        </div>
      </div>
      <div className="vc-req-body">
        {items.map((it, n) => {
          if (it.k === 'think') return <VC_Thinking key={n} block={it.b} />;
          if (it.k === 'text') return <VC_Text key={n} block={it.b} />;
          if (it.k === 'tool') return <VC_Inline key={n} toolUse={it.toolUse} diff={it.diff} />;
          if (it.k === 'orphan') return <VC_Inline key={n} toolUse={{ name: 'diff', input: { path: it.diff.path }, duration: 0, status: 'ok' }} diff={it.diff} />;
          return null;
        })}
      </div>
    </div>
  );
}

function VC_UserPrompt({ turn }) {
  return (
    <div className="vc-user">
      <div className="vc-user-bubble">
        <div className="vc-user-cap">
          <span>You</span>
          <span className="vc-sep">·</span>
          <span>{turn.time}</span>
        </div>
        <div className="vc-user-text">{turn.prompt}</div>
      </div>
    </div>
  );
}

function VariantC() {
  const { t4, t7 } = getSlice();
  return (
    <div className="variant variant-c">
      {[t4, t7].map(turn => (
        <section key={turn.id} className="vc-turn">
          <header className="vc-turn-head">
            <h2>Turn {turn.id.replace('T', '')}</h2>
            <span className="vc-turn-meta">
              {turn.time} · {fmtCost(turn.requests.reduce((s, r) => s + r.cost, 0))} · {turn.requests.length} {turn.requests.length === 1 ? 'request' : 'requests'}
            </span>
          </header>
          <VC_UserPrompt turn={turn} />
          {turn.requests.map((r, i) => <VC_Request key={r.id} request={r} idx={i} total={turn.requests.length} />)}
        </section>
      ))}
    </div>
  );
}

window.VariantC = VariantC;
