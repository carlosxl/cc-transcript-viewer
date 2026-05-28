// Direction A — refined: YOU as boxed quote, REQUEST as spine, HARNESS as indented step.

function DA_UserPrompt({ turn }) {
  return (
    <div className="da-user" data-comment-anchor="user-prompt">
      <div className="da-user-header">
        <span className="da-user-mark" aria-hidden="true" />
        <span className="da-user-label">You</span>
        <span className="da-user-time">{turn.time}</span>
      </div>
      <div className="da-user-body">{turn.prompt}</div>
    </div>
  );
}

function DA_Block({ block }) {
  if (block.kind === 'thinking') {
    return (
      <div className="da-think">
        <span className="da-think-mark">thinking</span>
        <span className="da-think-body">{block.body}</span>
      </div>
    );
  }
  if (block.kind === 'text') {
    return <div className="da-text">{renderInline(block.body)}</div>;
  }
  if (block.kind === 'tool_use') {
    return (
      <div className="da-call">
        <span className="da-arrow">→</span>
        <span className="da-name">{block.name}</span>
        <span className="da-arg">{toolArg(block)}</span>
      </div>
    );
  }
  return null;
}

function DA_Result({ toolUse, diff }) {
  if (!toolUse) {
    return (
      <div className="da-result">
        <div className="da-result-head">
          <span className="da-return-glyph">↳</span>
          <span className="da-name">diff</span>
          <span className="da-arg">{diff.path}</span>
        </div>
        <div className="da-diff">
          <div className="da-diff-meta">
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
    <div className="da-result">
      <div className="da-result-head">
        <span className="da-return-glyph">↳</span>
        <span className="da-name">{toolUse.name}</span>
        <span className="da-arg">{toolArg(toolUse)}</span>
        <span className="da-dur">{fmtDur(toolUse.duration)}</span>
        <span className={'da-st ' + (toolUse.status === 'err' ? 'err' : 'ok')}>
          {toolUse.status === 'err' ? 'error' : 'ok'}
        </span>
      </div>
      {diff ? (
        <div className="da-diff">
          <div className="da-diff-meta">
            <span>{diff.path}</span>
            <span className="add">+{diff.adds}</span>
            <span className="del">−{diff.dels}</span>
          </div>
          <DiffLines hunks={diff.hunks} dense />
        </div>
      ) : toolUse.preview ? (
        <pre className="da-preview">{toolUse.preview}</pre>
      ) : null}
    </div>
  );
}

function DA_Request({ request, idx, total }) {
  const { assistantBlocks, harnessResults } = splitRequest(request);
  const toolDur = harnessResults.reduce((s, h) => s + (h.toolUse?.duration || 0), 0);
  const toolCount = harnessResults.filter(h => h.toolUse).length;

  return (
    <div className="da-req-group">
      {/* request: solid accent spine */}
      <div className="da-request">
        <div className="da-spine" />
        <div className="da-req-body">
          <div className="da-req-cap">
            <span className="da-req-num">{`REQ ${idx + 1}/${total}`}</span>
            <span className="da-sep">·</span>
            <span className="da-req-id">{request.id}</span>
            <span className="da-sep">·</span>
            <span className="da-nowrap">{request.ttft}ms TTFT</span>
            <span className="da-sep">·</span>
            <span className="da-nowrap">{fmtDur(request.duration)}</span>
            <span className="da-sep">·</span>
            <span className="da-nowrap">{fmtK(request.tokens.in)} in · {fmtK(request.tokens.out)} out</span>
            <span className="da-req-cost">{fmtCost(request.cost)}</span>
          </div>
          {assistantBlocks.map(({ block, idx: i }) => (
            <DA_Block key={i} block={block} />
          ))}
        </div>
      </div>

      {/* harness: indented step, no rail */}
      {harnessResults.length > 0 && (
        <div className="da-harness">
          {harnessResults.map((r, i) => <DA_Result key={i} toolUse={r.toolUse} diff={r.diff} />)}
          <div className="da-harness-foot">
            <span className="da-harness-rule" />
            <span className="da-harness-foot-text">
              harness · {toolCount} {toolCount === 1 ? 'tool' : 'tools'}{toolDur > 0 ? ` · ${fmtDur(toolDur)}` : ''} · fed into next request
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function DA_Turn({ turn }) {
  const totalCost = turn.requests.reduce((s, r) => s + r.cost, 0);
  return (
    <div className="da-turn">
      <div className="da-turn-divider">
        <span className="da-turn-id">Turn {turn.id.replace('T', '')}</span>
        <span className="da-turn-rule" />
        <span className="da-turn-meta">{turn.time} · {turn.requests.length} {turn.requests.length === 1 ? 'request' : 'requests'} · {fmtCost(totalCost)}</span>
      </div>
      <DA_UserPrompt turn={turn} />
      {turn.requests.map((r, i) => <DA_Request key={r.id} request={r} idx={i} total={turn.requests.length} />)}
    </div>
  );
}

function DirectionA() {
  const { t4, t7 } = getSlice();
  return (
    <div className="direction-a">
      <DA_Turn turn={t4} />
      <DA_Turn turn={t7} />
    </div>
  );
}

window.DirectionA = DirectionA;
