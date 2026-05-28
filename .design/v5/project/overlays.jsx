// Overlays — search palette, session report, turn jumper

const { useRef: useRef2, useEffect: useEffect2, useState: useState2 } = React;

// ---------- Search palette ----------
function SearchPalette({ open, onClose, results, onPick }) {
  const inputRef = useRef2(null);
  const [query, setQuery] = useState2('FOR UPDATE');
  const [active, setActive] = useState2(0);

  useEffect2(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      setActive(0);
    }
  }, [open]);

  useEffect2(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) onPick(results[active]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, active, results, onPick]);

  if (!open) return null;

  // group by project
  const groups = {};
  results.forEach((r) => {
    (groups[r.project] = groups[r.project] || []).push(r);
  });

  return (
    <>
      <div className="overlay-backdrop" onClick={onClose} />
      <div className="palette-shell" role="dialog" aria-label="Search">
        <div className="palette-input-row">
          <span style={{ color: 'var(--text-2)' }}><I.search size={16} /></span>
          <input
            ref={inputRef}
            placeholder="Search sessions, tools, files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="esc"><span className="kbd" style={{ fontSize: 9 }}>ESC</span></span>
        </div>
        <div className="palette-status">
          <span>Indexing 9 sessions · 4,302 messages</span>
          <span className="progress"><span className="bar" style={{ width: '72%' }} /></span>
          <span>72%</span>
        </div>
        <div className="palette-results">
          {results.length === 0 ? (
            <div className="palette-empty">
              Start typing to search across all sessions.
              <div className="k">tools · files · diffs · text · tool_results · prompts</div>
            </div>
          ) : (
            Object.keys(groups).map((proj) => (
              <div key={proj}>
                <div className="palette-group-h">
                  <span><I.folder /></span>
                  <span>{proj}</span>
                  <span className="meta">· {groups[proj].length} matches</span>
                </div>
                {groups[proj].map((r, i) => {
                  const absIdx = results.indexOf(r);
                  return (
                    <div
                      key={r.sessionId + i}
                      className="palette-result"
                      data-active={active === absIdx || undefined}
                      onMouseEnter={() => setActive(absIdx)}
                      onClick={() => onPick(r)}
                    >
                      <div className="top">
                        <span className="badge">{r.badge}</span>
                        <span>{r.sessionTitle}</span>
                      </div>
                      <div
                        className="snippet"
                        dangerouslySetInnerHTML={{ __html: r.snippet }}
                      />
                      <div className="meta">{r.target} · {r.time}</div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="palette-footer">
          <span className="hint"><span className="kbd" style={{ fontSize: 9 }}>↑↓</span> navigate</span>
          <span className="hint"><span className="kbd" style={{ fontSize: 9 }}>↵</span> open</span>
          <span className="hint"><span className="kbd" style={{ fontSize: 9 }}>esc</span> dismiss</span>
          <span style={{ marginLeft: 'auto' }}>3 entry points · ⌘K · / · sidebar button</span>
        </div>
      </div>
    </>
  );
}

// ---------- Turn jumper ----------
function TurnJumper({ open, onClose, turns, anchorRect, onPick, focusedTurnId }) {
  const [active, setActive] = useState2(0);
  useEffect2(() => {
    if (!open) return;
    const idx = Math.max(0, turns.findIndex((t) => t.id === focusedTurnId));
    setActive(idx);
  }, [open, focusedTurnId, turns]);

  useEffect2(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, turns.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); onPick(turns[active]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, active, turns, onPick]);

  if (!open) return null;
  const style = anchorRect
    ? { top: anchorRect.bottom + 6, left: anchorRect.left }
    : { top: 100, left: 320 };
  return (
    <>
      <div className="overlay-backdrop" style={{ background: 'transparent', backdropFilter: 'none' }} onClick={onClose} />
      <div className="jumper-shell" style={style}>
        <div className="jumper-head">
          <span>Turn jumper</span>
          <span className="count">{turns.length} Turns</span>
        </div>
        <div className="jumper-list">
          {turns.map((t, i) => {
            const reqs = t.requests.length;
            const blocks = t.requests.reduce((s, r) => s + r.blocks.length, 0);
            const cost = t.requests.reduce((s, r) => s + r.cost, 0);
            return (
              <div
                key={t.id}
                className="jumper-row"
                data-active={active === i || undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => onPick(t)}
              >
                <div className="id">{t.id}<span className="time">{t.time}</span></div>
                <div className="preview">{shortPreview(t.prompt, 70)}</div>
                <div className="meta">
                  <span>{reqs}r</span>
                  <span>{blocks}b</span>
                  <span className="cost">{fmtCost(cost)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ---------- Session report ----------
function Sparkline({ data, height = 80, accent = 'var(--accent)' }) {
  const w = 600; const h = height; const pad = 8;
  const max = Math.max(...data, 0.0001);
  const points = data.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1);
    const y = h - pad - (v / max) * (h - pad * 2);
    return [x, y];
  });
  const path = points.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const areaPath = path + ` L ${points[points.length - 1][0].toFixed(1)} ${h - pad} L ${points[0][0].toFixed(1)} ${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#spark-fill)" />
      <path d={path} stroke={accent} strokeWidth="1.5" fill="none" />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={accent} />
      ))}
    </svg>
  );
}

function SessionReport({ open, onClose, report, sessionTitle }) {
  const closeBtnRef = useRef2(null);
  useEffect2(() => {
    if (open) setTimeout(() => closeBtnRef.current?.focus(), 30);
  }, [open]);

  if (!open) return null;

  const series = report.byTurn.map((t) => t.cost);
  const hitPct = (report.cacheHit * 100).toFixed(0) + '%';
  const totalsByModel = report.byModel.reduce((acc, r) => {
    acc.input += r.input; acc.c5 += r.c5; acc.c1 += r.c1; acc.cRd += r.cRd; acc.output += r.output; acc.cost += r.cost;
    return acc;
  }, { input: 0, c5: 0, c1: 0, cRd: 0, output: 0, cost: 0 });
  const totalHit = totalsByModel.cRd / (totalsByModel.cRd + totalsByModel.c5 + totalsByModel.c1 + totalsByModel.input);

  return (
    <>
      <div className="overlay-backdrop" onClick={onClose} />
      <div className="report-shell" role="dialog" aria-label="Session report">
        <div className="report-head">
          <div>
            <div className="kicker">Session report</div>
            <div className="title">{sessionTitle}</div>
          </div>
          <button ref={closeBtnRef} className="icon-btn close" onClick={onClose} aria-label="close">
            <I.x />
          </button>
        </div>
        <div className="report-body">
          <div className="stat-grid">
            <div className="stat-card"><div className="lbl">Duration</div><div className="val">{report.duration}</div><div className="sub">{report.turnCount} Turns</div></div>
            <div className="stat-card"><div className="lbl">Turns</div><div className="val">{report.turnCount}</div><div className="sub">avg ~$0.40</div></div>
            <div className="stat-card"><div className="lbl">Tool calls</div><div className="val">{report.toolCallsMain + report.toolCallsSub}</div><div className="sub">main {report.toolCallsMain} · sub {report.toolCallsSub}</div></div>
            <div className="stat-card"><div className="lbl">Cache hit</div><div className="val">{hitPct}</div><div className="sub">read / (read + create + input)</div></div>
            <div className="stat-card accent"><div className="lbl">Total cost</div><div className="val">{fmtCost(report.totalCost)}</div><div className="sub">{report.model}</div></div>
          </div>

          <div className="section-h">
            <div className="h">By agent & model</div>
            <div className="desc">raw tokens · dollars</div>
            <div className="right">
              <button className="export-btn">Export CSV</button>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Agent</th><th>Model</th>
                <th style={{ textAlign: 'right' }}>Input</th>
                <th style={{ textAlign: 'right' }}>Cache 5m</th>
                <th style={{ textAlign: 'right' }}>Cache 1h</th>
                <th style={{ textAlign: 'right' }}>Cache rd</th>
                <th style={{ textAlign: 'right' }}>Output</th>
                <th style={{ textAlign: 'right' }}>Cache hit</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {report.byModel.map((r, i) => (
                <tr key={i}>
                  <td className="agent">{r.agent}</td>
                  <td className="dim">{r.model}</td>
                  <td className="num">{r.input.toLocaleString()}</td>
                  <td className="num">{r.c5.toLocaleString()}</td>
                  <td className="num">{r.c1.toLocaleString()}</td>
                  <td className="num">{r.cRd.toLocaleString()}</td>
                  <td className="num">{r.output.toLocaleString()}</td>
                  <td className="num">{(r.hit * 100).toFixed(0)}%</td>
                  <td className="cost">{fmtCost(r.cost)}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan="2">Total</td>
                <td className="num">{totalsByModel.input.toLocaleString()}</td>
                <td className="num">{totalsByModel.c5.toLocaleString()}</td>
                <td className="num">{totalsByModel.c1.toLocaleString()}</td>
                <td className="num">{totalsByModel.cRd.toLocaleString()}</td>
                <td className="num">{totalsByModel.output.toLocaleString()}</td>
                <td className="num">{(totalHit * 100).toFixed(0)}%</td>
                <td className="cost">{fmtCost(totalsByModel.cost)}</td>
              </tr>
            </tbody>
          </table>

          <div className="section-h">
            <div className="h">By turn</div>
            <div className="desc">cache-write delta proxy · includes attachments</div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Turn</th><th>Prompt</th>
                <th style={{ textAlign: 'right' }}>Requests</th>
                <th style={{ textAlign: 'right' }}>Blocks</th>
                <th style={{ textAlign: 'right' }}>Attachments</th>
                <th style={{ textAlign: 'right' }}>Cache-write Δ</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {report.byTurn.map((t) => (
                <tr key={t.id}>
                  <td className="agent">{t.id}</td>
                  <td className="dim" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortPreview(t.prompt, 50)}</td>
                  <td className="num">{t.requests}</td>
                  <td className="num">{t.blocks}</td>
                  <td className="num">{t.attachments || '—'}</td>
                  <td className="num">{t.cacheDelta.toLocaleString()}</td>
                  <td className="cost">{fmtCost(t.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="info-callout">
            <strong style={{ color: 'var(--text-0)' }}>Cache-write Δ</strong> &nbsp;=&nbsp; <code>(cc + cr)[N] − (cc + cr)[N-1]</code> &nbsp; — the per-turn cache-write delta, which already includes attachment tokens injected at the same timestamp.
          </div>

          <div className="section-h">
            <div className="h">Usage over time</div>
            <div className="desc">cost per Turn · top 3 spikes</div>
          </div>
          <div className="over-time-row">
            <div className="spark-wrap">
              <div className="ylbl">$ per Turn</div>
              <Sparkline data={series} height={140} accent="var(--accent)" />
            </div>
            <div className="spike-cards">
              {report.spikes.map((s, i) => (
                <div className="spike-card" key={s.id}>
                  <span className="rank">#{i + 1}</span>
                  <div className="body">
                    <div className="turn">Turn {s.id}</div>
                    <div className="prompt">{shortPreview(s.prompt, 56)}</div>
                  </div>
                  <span className="cost">{fmtCost(s.cost)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="section-h">
            <div className="h">Files touched</div>
            <div className="desc">read/write timeline · sorted by total activity</div>
          </div>
          <div style={{ border: '1px solid var(--border-1)', borderRadius: 6, overflow: 'hidden' }}>
            {report.files.map((f) => (
              <div className="files-row" key={f.path}>
                <div>
                  <span className="path">{f.path}</span>
                  {f.changed && <span className="changed-tag">changed</span>}
                </div>
                <div className="timeline">
                  {f.pips.map((p, i) => (
                    <span
                      key={i}
                      className={'pip ' + p.k}
                      style={{ left: (p.t * 100) + '%' }}
                      title={p.k === 'r' ? 'read' : 'write'}
                    />
                  ))}
                </div>
                <div className="count">{f.count}</div>
              </div>
            ))}
          </div>

          <div style={{ height: 24 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--accent)' }} /> read</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--green)' }} /> write</span>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { SearchPalette, TurnJumper, SessionReport, Sparkline });
