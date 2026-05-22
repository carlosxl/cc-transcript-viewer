// Transcript pane — session header, sticky nav bar, transcript body

const { useEffect, useRef } = React;

// Render light markdown-ish text (just **bold**, `code`, and \n)
function renderInline(s) {
  if (!s) return null;
  const out = [];
  // split by line first
  const lines = s.split('\n');
  lines.forEach((line, li) => {
    const parts = [];
    let i = 0; let key = 0;
    while (i < line.length) {
      if (line.startsWith('**', i)) {
        const end = line.indexOf('**', i + 2);
        if (end !== -1) {
          parts.push(<strong key={key++}>{line.slice(i + 2, end)}</strong>);
          i = end + 2; continue;
        }
      }
      if (line[i] === '`') {
        const end = line.indexOf('`', i + 1);
        if (end !== -1) {
          parts.push(<code key={key++}>{line.slice(i + 1, end)}</code>);
          i = end + 1; continue;
        }
      }
      // accumulate text until next special
      let next = line.length;
      const a = line.indexOf('**', i + 1); if (a !== -1 && a < next) next = a;
      const b = line.indexOf('`', i + 1); if (b !== -1 && b < next) next = b;
      parts.push(<span key={key++}>{line.slice(i, next)}</span>);
      i = next;
    }
    out.push(<span key={li}>{parts}</span>);
    if (li < lines.length - 1) out.push(<br key={'br' + li} />);
  });
  return out;
}

function shortPreview(s, n = 80) {
  if (!s) return '';
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function ToolCapsule({ block, focused, onClick, onSubagentDrill }) {
  const argSummary = (() => {
    if (!block.input) return '';
    const keys = Object.keys(block.input);
    if (keys.length === 0) return '';
    if (block.name === 'Bash') return block.input.command || '';
    if (block.name === 'Read' || block.name === 'Write' || block.name === 'Edit') return block.input.path || '';
    if (block.name === 'Grep') return `"${block.input.pattern}"${block.input.path ? ` in ${block.input.path}` : ''}`;
    if (block.name === 'Glob') return block.input.pattern || '';
    if (block.name === 'Agent') return block.input.description || '';
    return keys.slice(0, 2).map(k => `${k}=${JSON.stringify(block.input[k]).slice(0, 24)}`).join(' · ');
  })();

  return (
    <div
      className={'tool-capsule' + (block.isSubagent ? ' subagent-call' : '')}
      data-active={focused || undefined}
      onClick={onClick}
    >
      <div className="tc-head">
        <span className="tc-kind">tool_use ·</span>
        <span className="tc-name">{block.name}</span>
        <span className="tc-arg">{argSummary}</span>
        <span className="tc-dur">{block.duration < 1000 ? `${block.duration}ms` : `${(block.duration / 1000).toFixed(1)}s`}</span>
        <span className={'tc-status ' + (block.status === 'err' ? 'err' : 'ok')}>
          {block.status === 'err' ? 'error' : 'ok'}
        </span>
      </div>
      {block.preview && <pre className="tc-preview">{block.preview}</pre>}
      {block.isSubagent && (
        <div className="sa-cta" onClick={(e) => { e.stopPropagation(); onSubagentDrill && onSubagentDrill(block.subagentRef); }}>
          <span className="sa-cta-text">
            <I.agent />
            <span>Open subagent transcript</span>
          </span>
          <span className="sa-stats">4 turns · 5 tool calls · $0.62 · <I.chevronRight /></span>
        </div>
      )}
    </div>
  );
}

function DiffBlock({ block, focused, onClick }) {
  return (
    <div
      className="diff"
      data-active={focused || undefined}
      onClick={onClick}
    >
      <div className="diff-head">
        <span className="path">{block.path}</span>
        <span className="lang">· {block.lang}</span>
        <span className="nums">
          <span className="add">+{block.adds}</span>
          <span className="del">−{block.dels}</span>
        </span>
      </div>
      <div className="diff-body clipped">
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
  );
}

function ThinkingBlock({ block }) {
  return (
    <div className="block-thinking">
      <span className="label">thinking</span>
      <span className="block-thinking-body">{block.body}</span>
    </div>
  );
}

function Block({ block, focusedBlockId, blockId, onFocus, onSubagentDrill }) {
  const focused = focusedBlockId === blockId;
  if (block.kind === 'thinking') return <div className="block"><ThinkingBlock block={block} /></div>;
  if (block.kind === 'text') return <div className="block block-text">{renderInline(block.body)}</div>;
  if (block.kind === 'tool_use') return (
    <div className="block">
      <ToolCapsule
        block={block}
        focused={focused}
        onClick={(e) => { e.stopPropagation(); onFocus(blockId, block); }}
        onSubagentDrill={onSubagentDrill}
      />
    </div>
  );
  if (block.kind === 'diff') return (
    <div className="block">
      <DiffBlock
        block={block}
        focused={focused}
        onClick={(e) => { e.stopPropagation(); onFocus(blockId, block); }}
      />
    </div>
  );
  return null;
}

function RequestNode({ turn, request, idx, total, focusedId, focusedBlockId, onFocusNode, onFocusBlock, onSubagentDrill }) {
  const focused = focusedId === request.id;
  const totalCost = request.cost;
  return (
    <div
      className="node request-node"
      data-focused={focused || undefined}
      data-node-id={request.id}
      onClick={() => onFocusNode(request.id, { kind: 'request', turn, request, idx, total })}
    >
      <div className="node-label">
        <span className="nl-id">REQUEST {request.id.toUpperCase()}</span>
        <span className="nl-meta">· request {idx + 1} of {total} · {request.duration < 1000 ? `${request.duration}ms` : `${(request.duration / 1000).toFixed(1)}s`}</span>
        <span className="nl-cost">{fmtCost(totalCost)}</span>
      </div>
      <div
        className="req-marker-row"
        data-focused={focused || undefined}
      >
        <span className="req-k">Request {idx + 1}/{total}</span>
        <span className="sep">·</span>
        <span>{request.blocks.length} {request.blocks.length === 1 ? 'block' : 'blocks'}</span>
        <span className="sep">·</span>
        <span>{request.ttft}ms TTFT</span>
        <span className="sep">·</span>
        <span>{request.duration < 1000 ? `${request.duration}ms` : `${(request.duration / 1000).toFixed(2)}s`}</span>
        <span className="req-cost">{fmtCost(totalCost)}</span>
      </div>
      {request.blocks.map((b, i) => (
        <Block
          key={i}
          block={b}
          blockId={`${request.id}:b${i}`}
          focusedBlockId={focusedBlockId}
          onFocus={(bid, blk) => onFocusBlock(bid, blk, request, turn)}
          onSubagentDrill={onSubagentDrill}
        />
      ))}
    </div>
  );
}

function UserPrompt({ turn, focusedId, onFocusNode }) {
  const focused = focusedId === turn.userMsgId;
  const isStderr = /^\[stderr\]/.test(turn.prompt);
  return (
    <div
      className="node"
      data-focused={focused || undefined}
      data-node-id={turn.userMsgId}
      onClick={() => onFocusNode(turn.userMsgId, { kind: 'user', turn })}
    >
      <div className="node-label">
        <span className="nl-id">USER MESSAGE {turn.userMsgId}</span>
        <span className="nl-meta">· {turn.time}{isStderr ? ' · stderr envelope' : ''}{turn.attachments?.length ? ` · ${turn.attachments.length} attached events` : ''}</span>
      </div>
      <div className="user-prompt">
        <div className="user-prompt-text">{turn.prompt}</div>
        {turn.attachments?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <div className="user-prompt-attach">
              <span className="k">+</span>
              <span>{turn.attachments.length} attached events</span>
              <span className="k">·</span>
              <span>~{fmtK(turn.attachments.reduce((s, a) => s + a.tokens, 0))} tokens</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Turn({ turn, idx, focusedId, focusedBlockId, onFocusNode, onFocusBlock, onSubagentDrill, onFocusTurn }) {
  const turnCost = turn.requests.reduce((s, r) => s + r.cost, 0);
  return (
    <section data-turn-id={turn.id}>
      <div
        className="turn-divider"
        data-focused={focusedId === turn.userMsgId || turn.requests.some(r => r.id === focusedId) || undefined}
        onClick={() => onFocusTurn(turn)}
      >
        <span className="turn-pill">
          <span className="id">Turn {turn.id}</span>
          <span className="time">{turn.time}</span>
          <span className="cost">{fmtCost(turnCost)}</span>
        </span>
      </div>
      <UserPrompt turn={turn} focusedId={focusedId} onFocusNode={onFocusNode} />
      {turn.requests.map((r, i) => (
        <RequestNode
          key={r.id}
          turn={turn}
          request={r}
          idx={i}
          total={turn.requests.length}
          focusedId={focusedId}
          focusedBlockId={focusedBlockId}
          onFocusNode={onFocusNode}
          onFocusBlock={onFocusBlock}
          onSubagentDrill={onSubagentDrill}
        />
      ))}
    </section>
  );
}

function TranscriptNavBar({ session, focusedTurn, focusedRequestIdx, focusedTurnReqCount, onTurnStep, onReqStep, onPromptStep, onToolStep, onOpenJumper, turnsTotal }) {
  const focusedCost = focusedTurn ? focusedTurn.requests.reduce((s, r) => s + r.cost, 0) : 0;
  const promptPreview = focusedTurn ? shortPreview(focusedTurn.prompt, 90) : '';
  return (
    <div className="tx-nav">
      <div className="stepper" title="Turn">
        <button onClick={() => onTurnStep(-1)} aria-label="prev turn"><I.chevronLeft /></button>
        <button className="label clickable" onClick={onOpenJumper}>
          <span className="k">Turn</span>
          <span>{focusedTurn ? focusedTurn.id : '—'}</span>
          <span className="muted" style={{ fontSize: 10 }}>/{turnsTotal}</span>
        </button>
        <button onClick={() => onTurnStep(1)} aria-label="next turn"><I.chevronRight /></button>
      </div>

      <div className="stepper" title="Request">
        <button onClick={() => onReqStep(-1)} aria-label="prev request"><I.chevronLeft /></button>
        <span className="label">
          <span className="k">Req</span>
          <span>{focusedRequestIdx >= 0 ? focusedRequestIdx + 1 : '—'}/{focusedTurnReqCount || '—'}</span>
        </span>
        <button onClick={() => onReqStep(1)} aria-label="next request"><I.chevronRight /></button>
      </div>

      <div className="stepper" title="User prompt (skips stderr)">
        <button onClick={() => onPromptStep(-1)} aria-label="prev prompt"><I.chevronLeft /></button>
        <span className="label"><span className="k">Prompt</span><span style={{ color: 'var(--text-2)' }}>n / N</span></span>
        <button onClick={() => onPromptStep(1)} aria-label="next prompt"><I.chevronRight /></button>
      </div>

      <div className="stepper" title="Tool call">
        <button onClick={() => onToolStep(-1)} aria-label="prev tool"><I.chevronLeft /></button>
        <span className="label"><span className="k">Tool</span><span style={{ color: 'var(--text-2)' }}>[ ]</span></span>
        <button onClick={() => onToolStep(1)} aria-label="next tool"><I.chevronRight /></button>
      </div>

      <div className="tx-nav-divider" />
      <div className="tx-nav-prompt">
        {focusedTurn ? <span><em>"</em>{promptPreview}<em>"</em></span> : <em>No turn focused</em>}
      </div>
      <div className="tx-nav-cost">
        <span className="k">Turn cost</span> {fmtCost(focusedCost)}
      </div>
    </div>
  );
}

function TranscriptHeader({
  session, isSubagent, parentBackLabel, onBack,
  onOpenReport, onToggleInspector, inspectorOpen,
  onToggleTheme, theme, onToggleDensity, density, livePending,
}) {
  const total = session.turns.reduce((s, t) => s + t.requests.reduce((ss, r) => ss + r.cost, 0), 0);
  const totalReqs = session.turns.reduce((s, t) => s + t.requests.length, 0);
  return (
    <div className="tx-header">
      <div className="tx-header-left">
        {isSubagent && (
          <div className="tx-breadcrumb" style={{ marginBottom: 4 }}>
            <button className="tx-back" onClick={onBack}>
              <I.chevronLeft />
              <span>Back to {parentBackLabel}</span>
            </button>
            <span style={{ color: 'var(--accent-2)' }}>Subagent transcript</span>
            <span className="sep">›</span>
            <span>spawned from Turn {session.parentTurnId}</span>
          </div>
        )}
        <div className="tx-title-row">
          <div className="tx-title">{session.title}</div>
        </div>
        <div className="tx-chips">
          <span className="chip"><span className="k">Turns</span> {session.turns.length}</span>
          <span className="chip"><span className="k">Requests</span> {totalReqs}</span>
          <span className="chip chip-cost"><span className="k">Cost</span> {fmtCost(total)}</span>
          <span className="chip"><span className="k">Model</span> {session.model}</span>
          {livePending && <span className="chip chip-live"><span className="dot" /> Live</span>}
        </div>
      </div>
      <div className="tx-actions">
        <button className="icon-btn icon-btn-lbl" onClick={onOpenReport} title="Session report (r)">
          <I.report />
          <span>Report</span>
        </button>
        <button className="icon-btn" data-active={!inspectorOpen || undefined} onClick={onToggleInspector} title="Toggle inspector">
          {inspectorOpen ? <I.panel /> : <I.panelOff />}
        </button>
        <button className="icon-btn" onClick={onToggleDensity} title="Density">
          <I.density />
        </button>
        <button className="icon-btn" onClick={onToggleTheme} title="Theme (t)">
          {theme === 'dark' ? <I.sun /> : <I.moon />}
        </button>
        <button className="icon-btn" title="More">
          <I.more />
        </button>
      </div>
    </div>
  );
}

function Transcript(props) {
  const {
    session, focusedNodeId, focusedBlockId, focusedNodeMeta,
    onFocusNode, onFocusBlock, onFocusTurn,
    onSubagentDrill, livePending, onFollowTail,
    onTurnStep, onReqStep, onPromptStep, onToolStep, onOpenJumper,
    isSubagent, parentBackLabel, onBack,
    onOpenReport, onToggleInspector, inspectorOpen,
    onToggleTheme, theme, onToggleDensity, density,
    bodyRef, showTailToast,
  } = props;

  // Compute current turn + req idx
  const focusedTurn = (() => {
    if (!focusedNodeMeta) return session.turns[session.turns.length - 1];
    return focusedNodeMeta.turn || session.turns[session.turns.length - 1];
  })();
  const focusedRequestIdx = focusedNodeMeta?.kind === 'request' ? focusedNodeMeta.idx : -1;
  const focusedTurnReqCount = focusedTurn?.requests.length || 0;

  return (
    <main className="transcript">
      <TranscriptHeader
        session={session}
        isSubagent={isSubagent}
        parentBackLabel={parentBackLabel}
        onBack={onBack}
        onOpenReport={onOpenReport}
        onToggleInspector={onToggleInspector}
        inspectorOpen={inspectorOpen}
        onToggleTheme={onToggleTheme}
        theme={theme}
        onToggleDensity={onToggleDensity}
        density={density}
        livePending={livePending}
      />
      <TranscriptNavBar
        session={session}
        focusedTurn={focusedTurn}
        focusedRequestIdx={focusedRequestIdx}
        focusedTurnReqCount={focusedTurnReqCount}
        onTurnStep={onTurnStep}
        onReqStep={onReqStep}
        onPromptStep={onPromptStep}
        onToolStep={onToolStep}
        onOpenJumper={onOpenJumper}
        turnsTotal={session.turns.length}
      />
      <div className="tx-body" ref={bodyRef} style={{ position: 'relative' }}>
        <div className="tx-body-inner">
          {session.turns.map((t, i) => (
            <Turn
              key={t.id}
              turn={t}
              idx={i}
              focusedId={focusedNodeId}
              focusedBlockId={focusedBlockId}
              onFocusNode={onFocusNode}
              onFocusBlock={onFocusBlock}
              onSubagentDrill={onSubagentDrill}
              onFocusTurn={(turn) => onFocusNode(turn.requests[turn.requests.length - 1]?.id || turn.userMsgId, {
                kind: turn.requests.length ? 'request' : 'user',
                turn,
                request: turn.requests[turn.requests.length - 1],
                idx: turn.requests.length - 1,
                total: turn.requests.length,
              })}
            />
          ))}
        </div>
        {showTailToast && (
          <div className="live-toast" onClick={onFollowTail}>
            <span className="dot" />
            <span>New Turn arrived</span>
            <kbd>Shift+G</kbd>
            <span style={{ color: 'var(--text-3)' }}>to follow</span>
          </div>
        )}
      </div>
    </main>
  );
}

Object.assign(window, {
  Transcript, Turn, RequestNode, UserPrompt, ToolCapsule, DiffBlock, ThinkingBlock,
  renderInline, shortPreview,
});
