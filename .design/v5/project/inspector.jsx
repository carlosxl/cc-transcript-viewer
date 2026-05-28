// Inspector — right rail

function InspectorEmpty() {
  return (
    <div className="ins-empty">
      <div className="h">Inspector</div>
      <div>Click any tool capsule, diff, request marker, or user prompt to inspect it.</div>
    </div>
  );
}

function MetricsRow({ items }) {
  return (
    <div className="ins-metrics">
      {items.map((it, i) => (
        <div className="ins-metric" key={i}>
          <div className="lbl">{it.lbl}</div>
          <div className={'val' + (it.dim ? ' dim' : '')}>{it.val}</div>
          {it.sub && <div className="sub">{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function CrumbStrip({ kind, parent, idStr, title, sub }) {
  return (
    <div className="ins-strip">
      <div className="ins-crumbs">
        <span className="kind">{kind}</span>
        {parent && <><span className="sep">›</span><span>{parent}</span></>}
        {idStr && <span className="ins-id">· {idStr}</span>}
      </div>
      <div className="ins-title">{title}</div>
      {sub && <div className="ins-sub">{sub}</div>}
    </div>
  );
}

function InspectorRequest({ meta, onJumpToBlock }) {
  const { request, turn, idx, total } = meta;
  const totalTokens = request.tokens.in + request.tokens.out + request.tokens.cc + request.tokens.cr;
  return (
    <>
      <CrumbStrip
        kind={`REQUEST ${request.id}`}
        parent={`TURN ${turn.id}`}
        idStr={`request ${idx + 1} of ${total}`}
        title={`Request ${idx + 1} of ${total}`}
        sub={`${request.blocks.length} ${request.blocks.length === 1 ? 'block' : 'blocks'} · ${request.ttft}ms TTFT · ${(request.duration / 1000).toFixed(2)}s`}
      />
      <div className="ins-body">
        <MetricsRow items={[
          { lbl: 'Cost', val: fmtCost(request.cost) },
          { lbl: 'Tokens', val: fmtK(totalTokens), dim: true, sub: `${fmtK(request.tokens.in)} in · ${fmtK(request.tokens.out)} out` },
          { lbl: 'Duration', val: `${(request.duration / 1000).toFixed(2)}s`, sub: `${request.ttft}ms TTFT` },
        ]} />
        <div className="ins-section">
          <div className="ins-section-title">Blocks in this request <span className="count">· {request.blocks.length}</span></div>
          {request.blocks.map((b, i) => (
            <div
              key={i}
              className="ins-block-row"
              onClick={() => onJumpToBlock && onJumpToBlock(`${request.id}:b${i}`, b, request, turn)}
            >
              <span className="num">{i + 1}</span>
              <span className="kind">{b.kind}</span>
              {b.kind === 'tool_use' && <span className="name">· {b.name}</span>}
              {b.kind === 'diff' && <span className="name" style={{ color: 'var(--text-2)' }}>· {b.path}</span>}
              {b.kind === 'text' && <span style={{ color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>· {shortPreview(b.body, 60)}</span>}
              {b.kind === 'thinking' && <span style={{ color: 'var(--text-3)', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>· {shortPreview(b.body, 60)}</span>}
              <span className="toks">{b.kind === 'tool_use' && b.duration ? (b.duration < 1000 ? `${b.duration}ms` : `${(b.duration / 1000).toFixed(1)}s`) : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function InspectorUser({ meta }) {
  const { turn } = meta;
  const chars = turn.prompt.length;
  const estTokens = Math.ceil(chars / 4);
  const attCount = turn.attachments?.length || 0;
  const attTokens = (turn.attachments || []).reduce((s, a) => s + a.tokens, 0);
  return (
    <>
      <CrumbStrip
        kind={`USER MESSAGE ${turn.userMsgId}`}
        parent={`TURN ${turn.id}`}
        title={`User input · Turn ${turn.id}`}
        sub={`${turn.time}`}
      />
      <div className="ins-body">
        <MetricsRow items={[
          { lbl: 'Characters', val: chars.toLocaleString() },
          { lbl: 'Est. tokens', val: '~' + fmtK(estTokens), dim: true },
          { lbl: '+ Attachments', val: attCount === 0 ? '0' : `~${fmtK(attTokens)}`, sub: attCount === 0 ? '' : `${attCount} events` },
        ]} />
        <div className="ins-section">
          <div className="ins-section-title">User prompt</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-0)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {turn.prompt}
          </div>
        </div>
        {attCount > 0 && (
          <div className="ins-section">
            <div className="ins-section-title">Attached events <span className="count">· {attCount}</span></div>
            {turn.attachments.map((a, i) => (
              <div className="ins-attach-row" key={i}>
                <span className="kind-tag">{a.kind}</span>
                <span className="desc">{a.desc}</span>
                <span className="tk">~{fmtK(a.tokens)}</span>
                <span className="ts">at {a.ts}</span>
              </div>
            ))}
            <div className="ins-caption">
              Auto-injected by Claude Code at the same timestamp as the user event. They count toward the next request's input.
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function InspectorTool({ meta, onSubagentDrill }) {
  const { block, request, turn } = meta;
  const fmtJson = (v) => {
    try { return JSON.stringify(v, null, 2); }
    catch { return String(v); }
  };
  return (
    <>
      <CrumbStrip
        kind="TOOL_USE"
        parent={`REQUEST ${request.id} › TURN ${turn.id}`}
        title={block.name}
        sub={`${block.duration < 1000 ? block.duration + 'ms' : (block.duration / 1000).toFixed(2) + 's'} · ${block.status === 'err' ? 'error' : 'ok'}`}
      />
      <div className="ins-body">
        <div className="ins-tool-section">
          <div className="ins-section-title">Input</div>
          <pre className="ins-pre">{fmtJson(block.input)}</pre>
        </div>
        <div className="ins-tool-section">
          <div className="ins-section-title">Output</div>
          <pre className={'ins-pre' + (block.status === 'err' ? ' err' : '')}>{block.output}</pre>
        </div>
        {block.isSubagent && (
          <div className="ins-tool-section">
            <div
              className="ins-drill"
              onClick={() => onSubagentDrill && onSubagentDrill(block.subagentRef)}
            >
              <div className="l">
                <I.agent />
                <div>
                  <div className="title">Open subagent transcript</div>
                  <div className="desc">4 turns · 5 tool calls · $0.62 · claude-haiku-4-5</div>
                </div>
              </div>
              <span className="ico"><I.arrowRight /></span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function InspectorDiff({ meta }) {
  const { block, request, turn } = meta;
  return (
    <>
      <CrumbStrip
        kind="DIFF"
        parent={`REQUEST ${request.id} › TURN ${turn.id}`}
        title={block.path}
        sub={`${block.lang} · +${block.adds} −${block.dels}`}
      />
      <div className="ins-body">
        <div className="ins-tool-section">
          <div className="ins-section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Full diff</span>
            <button className="export-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <I.copy /> Copy path
            </button>
          </div>
          <div className="diff" style={{ marginTop: 8 }}>
            <div className="diff-body no-clip">
              {block.hunks.map((h, i) => {
                if (h.type === 'hunk') {
                  return <div key={i} className="diff-line hunk">{h.text}</div>;
                }
                const cls = h.type === 'add' ? 'add' : h.type === 'del' ? 'del' : '';
                const sym = h.type === 'add' ? '+' : h.type === 'del' ? '−' : ' ';
                return (
                  <div key={i} className={'diff-line ' + cls}>
                    <div className="gut">{h.n || ''}</div>
                    <div className={'gut' + (cls ? ' mark' : '')}>{sym}</div>
                    <div className="src">{h.text}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Inspector({ focusedNodeMeta, focusedBlockMeta, onJumpToBlock, onSubagentDrill }) {
  // Block focus takes precedence over node focus
  if (focusedBlockMeta) {
    const { block } = focusedBlockMeta;
    if (block.kind === 'tool_use') return <aside className="inspector"><InspectorTool meta={focusedBlockMeta} onSubagentDrill={onSubagentDrill} /></aside>;
    if (block.kind === 'diff') return <aside className="inspector"><InspectorDiff meta={focusedBlockMeta} /></aside>;
  }
  if (focusedNodeMeta) {
    if (focusedNodeMeta.kind === 'request') return <aside className="inspector"><InspectorRequest meta={focusedNodeMeta} onJumpToBlock={onJumpToBlock} /></aside>;
    if (focusedNodeMeta.kind === 'user') return <aside className="inspector"><InspectorUser meta={focusedNodeMeta} /></aside>;
  }
  return <aside className="inspector"><InspectorEmpty /></aside>;
}

Object.assign(window, { Inspector });
