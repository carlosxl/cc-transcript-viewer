// Variant A — Quieter chrome / typographic hierarchy.
// Single small-caps caption per envelope; rails (solid accent = request,
// dashed gray = harness) instead of bordered cards; block-kind tags removed;
// the diff and tool calls do the talking, not the labels around them.

function VA_UserPrompt({ turn }) {
  return (
    <div className="va-user">
      <div className="va-user-rail" />
      <div className="va-user-body">
        <div className="va-user-cap">
          <span>YOU</span>
          <span className="dot" />
          <span>{turn.time}</span>
        </div>
        <div className="va-user-text">{turn.prompt}</div>
      </div>
    </div>
  );
}

function VA_Block({ block }) {
  if (block.kind === 'thinking') {
    return <div className="va-think">{block.body}</div>;
  }
  if (block.kind === 'text') {
    return <div className="va-text">{renderInline(block.body)}</div>;
  }
  if (block.kind === 'tool_use') {
    return (
      <div className="va-call">
        <span className="arrow">→</span>
        <span className="name">{block.name}</span>
        <span className="arg">{toolArg(block)}</span>
      </div>
    );
  }
  return null;
}

function VA_Result({ toolUse, diff }) {
  if (!toolUse) return null;
  const dur = fmtDur(toolUse.duration);
  return (
    <div className="va-result">
      <div className="va-result-head">
        <span className="arrow">←</span>
        <span className="name">{toolUse.name}</span>
        <span className="arg">{toolArg(toolUse)}</span>
        <span className="dur">{dur}</span>
        <span className={'st ' + (toolUse.status === 'err' ? 'err' : 'ok')}>
          {toolUse.status === 'err' ? 'error' : 'ok'}
        </span>
      </div>
      {diff ? (
        <div className="va-diff">
          <div className="va-diff-meta">
            <span>{diff.path}</span>
            <span className="add">+{diff.adds}</span>
            <span className="del">−{diff.dels}</span>
          </div>
          <DiffLines hunks={diff.hunks} dense />
        </div>
      ) : toolUse.preview ? (
        <pre className="va-preview">{toolUse.preview}</pre>
      ) : null}
    </div>
  );
}

function VA_Request({ request, idx, total }) {
  const { assistantBlocks, harnessResults } = splitRequest(request);
  const cap = [
    `REQ ${idx + 1}/${total}`,
    request.id,
    `${request.ttft}ms TTFT`,
    fmtDur(request.duration),
    `${fmtK(request.tokens.in)} in · ${fmtK(request.tokens.out)} out`,
    fmtCost(request.cost),
  ].join('   ·   ');

  const toolDur = harnessResults.reduce((s, h) => s + (h.toolUse?.duration || 0), 0);
  const toolCount = harnessResults.filter(h => h.toolUse).length;

  return (
    <div className="va-req-group">
      <div className="va-request">
        <div className="va-rail va-rail-req" />
        <div className="va-req-body">
          <div className="va-cap">{cap}</div>
          {assistantBlocks.map(({ block, idx: i }) => (
            <VA_Block key={i} block={block} />
          ))}
        </div>
      </div>

      {harnessResults.length > 0 && (
        <div className="va-harness">
          <div className="va-rail va-rail-har" />
          <div className="va-har-body">
            <div className="va-cap va-cap-har">
              HARNESS  ·  {toolCount} tool {toolCount === 1 ? 'call' : 'calls'}
              {toolDur > 0 ? `  ·  ${fmtDur(toolDur)}` : ''}
              <span className="trail">→ fed into next request</span>
            </div>
            {harnessResults.map((r, i) => <VA_Result key={i} toolUse={r.toolUse} diff={r.diff} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function VariantA() {
  const { t4, t7 } = getSlice();
  return (
    <div
      className="variant variant-a"
      data-tw-hide-thinking={window.__tweaks?.showThinking === false ? '1' : undefined}
      data-tw-compact={window.__tweaks?.compact ? '1' : undefined}
    >
      <div className="va-turn">
        <div className="va-turn-divider">
          <span>Turn 4</span>
          <span className="dot" />
          <span>{t4.time}</span>
          <span className="dot" />
          <span>{fmtCost(t4.requests.reduce((s, r) => s + r.cost, 0))}</span>
        </div>
        <VA_UserPrompt turn={t4} />
        {t4.requests.map((r, i) => <VA_Request key={r.id} request={r} idx={i} total={t4.requests.length} />)}
      </div>

      <div className="va-turn">
        <div className="va-turn-divider">
          <span>Turn 7</span>
          <span className="dot" />
          <span>{t7.time}</span>
          <span className="dot" />
          <span>{fmtCost(t7.requests.reduce((s, r) => s + r.cost, 0))}</span>
        </div>
        <VA_UserPrompt turn={t7} />
        {t7.requests.map((r, i) => <VA_Request key={r.id} request={r} idx={i} total={t7.requests.length} />)}
      </div>
    </div>
  );
}

window.VariantA = VariantA;
