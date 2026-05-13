// Right-rail tabs (Inspector / Tokens / Files), tokens chart, file timeline,
// minimap, and inspector empty/error/loading states.

// ── Sparkline + stacked bars chart ────────────────────────────────
function TokensChart({ data, height=120 }) {
  const max = Math.max(...data.map(d => d.input + d.output + d.cache), 1);
  const W = 1; // ratio-based
  return (
    <svg viewBox={`0 0 ${data.length * 18} ${height}`} preserveAspectRatio="none" style={{ width:"100%", height, display:"block" }}>
      {data.map((d, i) => {
        const total = d.input + d.output + d.cache;
        const h = (total / max) * (height - 18);
        const inH = (d.input / total) * h;
        const outH = (d.output / total) * h;
        const cacheH = (d.cache / total) * h;
        const x = i * 18 + 2;
        const y = height - 14;
        return (
          <g key={i}>
            <rect x={x} y={y - inH} width={14} height={inH} fill="var(--user-rail)" opacity=".7"/>
            <rect x={x} y={y - inH - outH} width={14} height={outH} fill="var(--accent)" opacity=".85"/>
            <rect x={x} y={y - inH - outH - cacheH} width={14} height={cacheH} fill="var(--success)" opacity=".55"/>
          </g>
        );
      })}
      <line x1="0" y1={height-14} x2={data.length*18} y2={height-14} stroke="var(--border)" strokeWidth=".5"/>
    </svg>
  );
}

function TokensPanel({ session }) {
  // Mock per-message token data
  const data = React.useMemo(() => Array.from({length: 28}, (_, i) => ({
    input:  Math.floor(20 + Math.random() * 80 + (i > 10 ? 100 : 0)),
    output: Math.floor(40 + Math.random() * 120),
    cache:  Math.floor(30 + Math.random() * 60),
  })), [session.id]);

  return (
    <div className="scroll" style={{ flex:1, overflow:"auto", padding:"16px 18px" }}>
      <div style={{ display:"grid", gap:16 }}>
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10 }}>
            <div style={{ fontWeight:600, fontSize:13, color:"var(--text)" }}>Token usage</div>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)" }}>per message · {session.msgs} msgs</div>
          </div>
          <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"10px 12px" }}>
            <TokensChart data={data}/>
            <div style={{ display:"flex", gap:14, marginTop:8, fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-3)" }}>
              <span><span style={{ display:"inline-block", width:9, height:9, background:"var(--user-rail)", borderRadius:2, marginRight:5 }}/>input</span>
              <span><span style={{ display:"inline-block", width:9, height:9, background:"var(--accent)", borderRadius:2, marginRight:5 }}/>output</span>
              <span><span style={{ display:"inline-block", width:9, height:9, background:"var(--success)", borderRadius:2, marginRight:5, opacity:.55 }}/>cache hit</span>
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <Stat label="Total" value={session.cost} sub="tokens"/>
          <Stat label="Weighted" value="$0.412" sub="USD"/>
          <Stat label="Cache hit" value="68%" sub="of input"/>
          <Stat label="Avg / turn" value="36.3K" sub="tokens"/>
        </div>

        <div>
          <div style={{ fontWeight:600, fontSize:13, color:"var(--text)", marginBottom:8 }}>By model</div>
          <ModelRow model="claude-opus-4.7"   pct={68} tokens="3.26M"/>
          <ModelRow model="claude-sonnet-4.5" pct={24} tokens="1.15M"/>
          <ModelRow model="claude-haiku-4.5"  pct={8}  tokens="384K"/>
        </div>

        <div>
          <div style={{ fontWeight:600, fontSize:13, color:"var(--text)", marginBottom:8 }}>Spike turns</div>
          <SpikeRow turn="m17" cost="412K" reason="Read 18 files"/>
          <SpikeRow turn="m41" cost="289K" reason="Long Bash output (truncated)"/>
          <SpikeRow turn="m83" cost="221K" reason="Diff over 412-line file"/>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"10px 12px" }}>
      <div style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500 }}>{label}</div>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:600, color:"var(--text)", marginTop:2 }}>{value}</div>
      <div style={{ fontSize:11, color:"var(--text-3)", marginTop:1 }}>{sub}</div>
    </div>
  );
}

function ModelRow({ model, pct, tokens }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0" }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"var(--font-mono)", fontSize:11.5, marginBottom:3 }}>
          <span style={{ color:"var(--text-2)" }}>{model}</span>
          <span style={{ color:"var(--text-3)" }}>{tokens}</span>
        </div>
        <div style={{ height:5, background:"var(--surface-3)", borderRadius:99, overflow:"hidden" }}>
          <div style={{ width:`${pct}%`, height:"100%", background:"var(--accent)" }}/>
        </div>
      </div>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)", width:32, textAlign:"right" }}>{pct}%</div>
    </div>
  );
}

function SpikeRow({ turn, cost, reason }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom:"1px solid var(--border-subtle)" }}>
      <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent-text)", fontWeight:600, width:36 }}>{turn}</span>
      <span style={{ fontFamily:"var(--font-mono)", fontSize:11.5, color:"var(--text-2)", flex:1 }}>{reason}</span>
      <span style={{ fontFamily:"var(--font-mono)", fontSize:11.5, color:"var(--text)", fontWeight:600 }}>{cost}</span>
    </div>
  );
}

// ── Files timeline ────────────────────────────────────────────────
function FilesPanel({ session, onJumpToTurn }) {
  const files = WS_ACTIVE.files;
  return (
    <div className="scroll" style={{ flex:1, overflow:"auto", padding:"16px 18px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10 }}>
        <div style={{ fontWeight:600, fontSize:13, color:"var(--text)" }}>Files touched</div>
        <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)" }}>{files.length} in session</div>
      </div>
      <div style={{ display:"grid", gap:8 }}>
        {files.map((f, i) => (
          <div key={i} style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"10px 12px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <Icon name="code" size={12} style={{ color:"var(--text-3)" }}/>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.path}</span>
              {f.changed && <span style={{ fontSize:10, color:"var(--diff-add-text)", background:"var(--diff-add-bg)", padding:"1px 5px", borderRadius:4, fontWeight:600 }}>CHANGED</span>}
            </div>
            <FileTimeline reads={f.reads} writes={f.writes} onJump={onJumpToTurn}/>
            <div style={{ display:"flex", gap:10, marginTop:6, fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)" }}>
              <span>{f.reads} read{f.reads !== 1 ? "s" : ""}</span>
              <span>{f.writes} write{f.writes !== 1 ? "s" : ""}</span>
              {f.lines && <span>L {f.lines}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileTimeline({ reads, writes, onJump }) {
  // Fake-distribute reads/writes along a 100-step timeline
  const events = [];
  for (let i = 0; i < reads; i++) events.push({ t: 10 + i * 25 + Math.random() * 8, kind: "r" });
  for (let i = 0; i < writes; i++) events.push({ t: 60 + i * 18 + Math.random() * 8, kind: "w" });
  return (
    <div style={{ position:"relative", height:14, background:"var(--surface-3)", borderRadius:99 }}>
      {events.map((e, i) => (
        <div key={i} onClick={onJump} title={`${e.kind === "r" ? "Read" : "Write"} at turn ~m${Math.floor(e.t)}`}
          style={{ position:"absolute", left:`${Math.min(e.t, 96)}%`, top:1, width:9, height:12,
                   background: e.kind === "w" ? "var(--accent)" : "var(--user-rail)",
                   borderRadius:3, cursor:"pointer", border:"1px solid var(--surface)" }}/>
      ))}
    </div>
  );
}

// ── Minimap on transcript right edge ─────────────────────────────
function Minimap({ messages, focused, onSeek }) {
  return (
    <div style={{ position:"absolute", top:0, right:0, bottom:0, width:14, padding:"12px 4px", display:"flex", flexDirection:"column", gap:1.5 }}>
      {messages.map((m, i) => {
        const tone = m.role === "user"
          ? (m.kind === "stderr" ? "var(--danger)" : m.kind === "command" ? "var(--accent)" : "var(--user-rail)")
          : "var(--claude-rail)";
        const isToolHeavy = m.parts?.some(p => p.type === "tool");
        return (
          <button key={i} onClick={() => onSeek(i)} title={m.role + " · " + (m.at || "")}
            style={{ flex:1, background: tone, opacity: i === focused ? 1 : .35,
                     border:"none", padding:0, cursor:"pointer", borderRadius:1.5,
                     outline: i === focused ? "1px solid var(--accent)" : "none", outlineOffset:1,
                     boxShadow: isToolHeavy ? "inset 0 0 0 2px var(--tool-rail)" : "none" }}/>
        );
      })}
    </div>
  );
}

// ── Message inspector — shown when j/k lands on a turn with no tool focus ─
// Surfaces per-message token economics (input / output / cache_create / cache_read),
// cache efficiency, context-window fill, generation stats, and per-part attribution.
// For user turns: input contribution + attachments + the assistant turn it feeds into.

function fmtTok(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 10_000)    return (n / 1_000).toFixed(0) + "K";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}
function fmtUSD(n) {
  if (n == null) return "—";
  if (n < 0.01)  return "$" + n.toFixed(4);
  if (n < 1)     return "$" + n.toFixed(3);
  return "$" + n.toFixed(2);
}
function fmtMs(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return ms + " ms";
  return (ms / 1000).toFixed(2) + " s";
}

// Composite stacked bar — single row, four segments.
function StackedBar({ segs, height=10 }) {
  const total = segs.reduce((a, s) => a + s.v, 0) || 1;
  return (
    <div style={{ display:"flex", height, borderRadius:99, overflow:"hidden",
                  background:"var(--surface-3)", border:"1px solid var(--border-subtle)" }}>
      {segs.map((s, i) => (
        <div key={i} title={`${s.label}: ${fmtTok(s.v)} (${((s.v/total)*100).toFixed(1)}%)`}
          style={{ width: `${(s.v/total)*100}%`, background: s.color, opacity: s.alpha ?? 1 }}/>
      ))}
    </div>
  );
}

// One legend / breakdown row.
function TokenRow({ swatch, alpha, label, value, total, hint }) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"5px 0" }}>
      <span style={{ width:9, height:9, borderRadius:2, background:swatch, opacity: alpha ?? 1, flex:"0 0 9px" }}/>
      <span style={{ fontSize:12, color:"var(--text-2)", flex:1, minWidth:0 }}>
        {label}
        {hint && <span style={{ marginLeft:6, color:"var(--text-4)", fontSize:10.5 }}>{hint}</span>}
      </span>
      <span style={{ fontFamily:"var(--font-mono)", fontSize:11.5, color:"var(--text)", fontWeight:500 }}>{fmtTok(value)}</span>
      <span style={{ fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)", width:38, textAlign:"right" }}>{pct.toFixed(1)}%</span>
    </div>
  );
}

function MetricCell({ label, value, sub, tone }) {
  return (
    <div style={{ padding:"10px 12px", background:"var(--surface-2)", border:"1px solid var(--border)",
                  borderRadius:"var(--r-2)", minWidth:0 }}>
      <div style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500 }}>{label}</div>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:16, fontWeight:600, marginTop:2,
                    color: tone === "accent" ? "var(--accent-text)" : "var(--text)" }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"var(--text-3)", marginTop:1 }}>{sub}</div>}
    </div>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div style={{ display:"flex", alignItems:"baseline", marginBottom:8, marginTop:4 }}>
      <div style={{ fontWeight:600, fontSize:11, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".07em" }}>{children}</div>
      <span style={{ flex:1 }}/>
      {right}
    </div>
  );
}

function AssistantMessageInspector({ m, onJumpBack, onJumpToPart }) {
  const u = m.usage;
  const total = (u.input||0) + (u.output||0) + (u.cache_create||0) + (u.cache_read||0);
  const cachedInput = (u.cache_read||0);
  const totalInput  = (u.input||0) + (u.cache_create||0) + (u.cache_read||0);
  const cachePct = totalInput ? (cachedInput / totalInput) * 100 : 0;
  const cost = estimateCost(m.model, u);
  const ctxPct = (u.context_used / CTX_WINDOW) * 100;
  const tps = u.duration_ms ? Math.round((u.output / u.duration_ms) * 1000) : null;

  const partColor = { text:"var(--text-3)", think:"var(--think-text)", tool:"var(--accent-text)", diff:"var(--diff-add-text)", markdown:"var(--text-2)" };
  const partIcon  = { text:"hash", think:"spark", tool:"tool", diff:"diff", markdown:"list" };

  return (
    <div className="scroll" style={{ flex:1, overflow:"auto", padding:"14px 18px 28px" }}>
      <div style={{ display:"grid", gap:16 }}>

        {/* Identity card */}
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em" }}>Assistant turn</span>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-2)", padding:"1px 6px", border:"1px solid var(--border)", borderRadius:4, background:"var(--surface-2)" }}>{m.id}</span>
            <span style={{ flex:1 }}/>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)" }}>{m.at}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:"var(--claude-tint)", color:"var(--claude-text)",
                          display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name="spark" size={14}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13.5, fontWeight:600, color:"var(--text)" }}>Claude</div>
              <div style={{ fontSize:11.5, color:"var(--text-3)", fontFamily:"var(--font-mono)" }}>{m.model} · {u.stop_reason}</div>
            </div>
            <button onClick={onJumpBack} className="cc-icon-btn" title="Scroll the transcript to this turn">
              <Icon name="chevron-left" size={11}/> Jump to turn
            </button>
          </div>
        </div>

        {/* Headline metrics */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <MetricCell label="Total tokens" value={fmtTok(total)} sub={`${fmtTok(u.input + u.cache_create + u.cache_read)} in · ${fmtTok(u.output)} out`}/>
          <MetricCell label="Weighted cost" value={fmtUSD(cost)} sub={`${m.model} pricing`} tone="accent"/>
        </div>

        {/* Composite breakdown */}
        <div>
          <SectionLabel>Breakdown</SectionLabel>
          <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"12px 12px 10px" }}>
            <StackedBar segs={[
              { v: u.input,        color:"var(--user-rail)",   label:"Input (fresh)" },
              { v: u.cache_create, color:"var(--warn)",         label:"Cache create", alpha:.75 },
              { v: u.cache_read,   color:"var(--success)",      label:"Cache read",   alpha:.55 },
              { v: u.output,       color:"var(--accent)",       label:"Output" },
            ]}/>
            <div style={{ marginTop:8 }}>
              <TokenRow swatch="var(--user-rail)" label="Input"        value={u.input}        total={total} hint="fresh, billed full"/>
              <TokenRow swatch="var(--warn)" alpha={.75} label="Cache create" value={u.cache_create} total={total} hint="1.25× input"/>
              <TokenRow swatch="var(--success)" alpha={.55} label="Cache read" value={u.cache_read} total={total} hint="0.1× input"/>
              <TokenRow swatch="var(--accent)" label="Output"       value={u.output}       total={total} hint="generated"/>
            </div>
          </div>
        </div>

        {/* Cache efficiency + context window */}
        <div style={{ display:"grid", gap:10 }}>
          <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"10px 12px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
              <span style={{ fontSize:11.5, color:"var(--text-2)", fontWeight:500 }}>Cache efficiency</span>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:12.5, color:"var(--text)", fontWeight:600 }}>{cachePct.toFixed(0)}%</span>
            </div>
            <div style={{ height:6, background:"var(--surface-3)", borderRadius:99, overflow:"hidden" }}>
              <div style={{ width:`${cachePct}%`, height:"100%", background:"var(--success)", opacity:.7 }}/>
            </div>
            <div style={{ marginTop:5, fontSize:11, color:"var(--text-3)", fontFamily:"var(--font-mono)" }}>
              {fmtTok(cachedInput)} of {fmtTok(totalInput)} input served from cache
            </div>
          </div>

          <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"10px 12px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
              <span style={{ fontSize:11.5, color:"var(--text-2)", fontWeight:500 }}>Context window</span>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:12.5, color:"var(--text)", fontWeight:600 }}>{ctxPct.toFixed(1)}%</span>
            </div>
            <div style={{ height:6, background:"var(--surface-3)", borderRadius:99, overflow:"hidden" }}>
              <div style={{ width:`${Math.min(ctxPct,100)}%`, height:"100%",
                            background: ctxPct > 80 ? "var(--danger)" : ctxPct > 50 ? "var(--warn)" : "var(--accent)" }}/>
            </div>
            <div style={{ marginTop:5, fontSize:11, color:"var(--text-3)", fontFamily:"var(--font-mono)" }}>
              {fmtTok(u.context_used)} / {fmtTok(CTX_WINDOW)} used after this turn
            </div>
          </div>
        </div>

        {/* Generation stats */}
        <div>
          <SectionLabel>Generation</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            <MetricCell label="TTFT"     value={fmtMs(u.ttft_ms)} sub="first token"/>
            <MetricCell label="Duration" value={fmtMs(u.duration_ms)} sub="total"/>
            <MetricCell label="Speed"    value={tps ? tps + " t/s" : "—"} sub="output"/>
          </div>
        </div>

        {/* Parts in this turn */}
        {u.parts?.length > 0 && (
          <div>
            <SectionLabel right={<span style={{ fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)" }}>{u.parts.length} parts</span>}>
              In this turn
            </SectionLabel>
            <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", overflow:"hidden" }}>
              {u.parts.map((p, i) => {
                const partTotal = u.parts.reduce((a, x) => a + (x.tokens||0), 0) || 1;
                const pct = ((p.tokens||0) / partTotal) * 100;
                const partIndex = m.parts.findIndex((mp, mi) => {
                  // best-effort: match by type+tool, in order
                  let seen = 0;
                  for (let j = 0; j <= i; j++) if (u.parts[j].type === p.type && (u.parts[j].tool||null) === (p.tool||null)) seen++;
                  let count = 0;
                  for (let k = 0; k <= mi; k++) if (m.parts[k].type === p.type && (m.parts[k].tool||null) === (p.tool||null)) count++;
                  return count === seen && m.parts[mi].type === p.type && (m.parts[mi].tool||null) === (p.tool||null);
                });
                const clickable = p.type === "tool" || p.type === "diff";
                return (
                  <button key={i} disabled={!clickable}
                    onClick={() => clickable && onJumpToPart && onJumpToPart(m.parts[partIndex], `${m.id}-${partIndex}`)}
                    style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"8px 12px",
                             background:"transparent", border:"none",
                             borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
                             cursor: clickable ? "pointer" : "default", color:"var(--text-2)",
                             fontFamily:"inherit", textAlign:"left" }}>
                    <Icon name={partIcon[p.type] || "hash"} size={12} style={{ color: partColor[p.type] || "var(--text-3)" }}/>
                    <span style={{ fontSize:12, color:"var(--text)", fontWeight: p.type === "tool" ? 500 : 400, minWidth:54 }}>
                      {p.type === "tool" ? p.tool : p.type[0].toUpperCase() + p.type.slice(1)}
                    </span>
                    <div style={{ flex:1, minWidth:40, height:4, background:"var(--surface-3)", borderRadius:99, overflow:"hidden" }}>
                      <div style={{ width:`${pct}%`, height:"100%", background: partColor[p.type] || "var(--text-3)", opacity:.55 }}/>
                    </div>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-2)", width:54, textAlign:"right" }}>{fmtTok(p.tokens)} tok</span>
                    {clickable && <Icon name="chevron-right" size={11} style={{ color:"var(--text-4)" }}/>}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop:6, fontSize:10.5, color:"var(--text-4)", fontFamily:"var(--font-mono)" }}>
              Click a tool or diff row to drill in.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UserMessageInspector({ m, messages, onJumpBack, onJumpToTurn }) {
  const u = m.usage || { chars:(m.text||m.args||"").length, est_tokens:Math.ceil((m.text||m.args||"").length/4), attachments:[] };
  const nextTurn = u.next_turn ? messages.find(x => x.id === u.next_turn) : null;
  const kindLabel = m.kind === "command" ? "Slash command" : m.kind === "stderr" ? "Tool error" : "User message";
  return (
    <div className="scroll" style={{ flex:1, overflow:"auto", padding:"14px 18px 28px" }}>
      <div style={{ display:"grid", gap:16 }}>

        {/* Identity */}
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em" }}>{kindLabel}</span>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-2)", padding:"1px 6px", border:"1px solid var(--border)", borderRadius:4, background:"var(--surface-2)" }}>{m.id}</span>
            <span style={{ flex:1 }}/>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)" }}>{m.at}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:28, height:28, borderRadius:"50%",
                          background: m.kind === "stderr" ? "var(--danger-soft)" : m.kind === "command" ? "var(--accent-soft)" : "var(--user-tint)",
                          color: m.kind === "stderr" ? "var(--danger)" : m.kind === "command" ? "var(--accent)" : "var(--user-text)",
                          display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name={m.kind === "stderr" ? "warn" : m.kind === "command" ? "command" : "user"} size={14}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13.5, fontWeight:600, color:"var(--text)" }}>
                {m.kind === "command" ? m.name : "You"}
              </div>
              <div style={{ fontSize:11.5, color:"var(--text-3)" }}>
                {m.kind === "command" ? "Local — does not call the model" : m.kind === "stderr" ? "Auto-injected by Claude Code" : "Direct prompt"}
              </div>
            </div>
            <button onClick={onJumpBack} className="cc-icon-btn" title="Scroll the transcript to this turn">
              <Icon name="chevron-left" size={11}/> Jump
            </button>
          </div>
        </div>

        {/* Note if any */}
        {u.note && (
          <div style={{ padding:"10px 12px", background:"var(--surface-2)", border:"1px solid var(--border)",
                        borderRadius:"var(--r-2)", fontSize:12, color:"var(--text-2)", lineHeight:1.55,
                        display:"flex", gap:8 }}>
            <Icon name="info" size={13} style={{ color:"var(--text-3)", flex:"0 0 13px", marginTop:1 }}/>
            <span>{u.note}</span>
          </div>
        )}

        {/* Input contribution */}
        <div>
          <SectionLabel>Input contribution</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <MetricCell label="Characters" value={u.chars.toLocaleString()} sub="raw text"/>
            <MetricCell label="Est. tokens" value={"~" + fmtTok(u.est_tokens)} sub="~4 chars / token"/>
          </div>
        </div>

        {/* Preview of payload */}
        <div>
          <SectionLabel right={<span style={{ fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)" }}>{m.kind || "text"}</span>}>
            Payload preview
          </SectionLabel>
          <div style={{ background:"var(--code-bg)", border:"1px solid var(--code-border)", borderRadius:"var(--r-2)",
                        padding:"10px 12px", fontFamily:"var(--font-mono)", fontSize:11.5, color:"var(--text-2)",
                        whiteSpace:"pre-wrap", wordBreak:"break-word", lineHeight:1.55,
                        maxHeight:140, overflow:"auto" }}>
            {m.kind === "command"
              ? (m.name + (m.args ? " " + m.args : ""))
              : (m.text || "(empty)")}
          </div>
        </div>

        {/* Attachments */}
        {u.attachments?.length > 0 && (
          <div>
            <SectionLabel>Attachments</SectionLabel>
            <div style={{ display:"grid", gap:6 }}>
              {u.attachments.map((a, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px",
                                       background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)" }}>
                  <Icon name={a.kind === "url" ? "ext" : a.kind === "image" ? "side" : "code"} size={12} style={{ color:"var(--text-3)" }}/>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:11.5, color:"var(--text-2)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.label}</span>
                  <span style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".05em" }}>{a.kind}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feeds into */}
        {nextTurn && (
          <div>
            <SectionLabel>Feeds into</SectionLabel>
            <button onClick={() => onJumpToTurn && onJumpToTurn(nextTurn.id)}
              style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px",
                       background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)",
                       cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
              <div style={{ width:24, height:24, borderRadius:"50%", background:"var(--claude-tint)", color:"var(--claude-text)",
                            display:"flex", alignItems:"center", justifyContent:"center", flex:"0 0 24px" }}>
                <Icon name="spark" size={12}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12.5, color:"var(--text)", fontWeight:500 }}>Assistant turn {nextTurn.id}</div>
                <div style={{ fontSize:11, color:"var(--text-3)", fontFamily:"var(--font-mono)" }}>
                  {fmtTok(nextTurn.usage?.input)} input · {fmtTok(nextTurn.usage?.output)} output · {fmtUSD(estimateCost(nextTurn.model, nextTurn.usage))}
                </div>
              </div>
              <Icon name="chevron-right" size={12} style={{ color:"var(--text-3)" }}/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageInspector({ message, messages, onJumpBack, onJumpToPart, onJumpToTurn }) {
  if (!message) return <InspectorEmpty/>;
  if (message.role === "assistant") {
    return <AssistantMessageInspector m={message} onJumpBack={onJumpBack} onJumpToPart={onJumpToPart}/>;
  }
  return <UserMessageInspector m={message} messages={messages} onJumpBack={onJumpBack} onJumpToTurn={onJumpToTurn}/>;
}

// ── Right rail: pure Inspector ───────────────────────────────────
// Priority: tool/diff drill-in (explicit click) > message inspector (j/k focus) > empty.
function RightRail({ activePart, activeDiff, focusedMessage, messages, onJumpBack, onJumpToPart, onJumpToTurn, onClose }) {
  const hasDrillIn = !!(activePart || activeDiff);
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--surface)", borderLeft:"1px solid var(--border)" }}>
      {hasDrillIn
        ? <Inspector part={activePart} diff={activeDiff} onJumpBack={onJumpBack} onClose={onClose}/>
        : focusedMessage
          ? <MessageInspector message={focusedMessage} messages={messages}
                              onJumpBack={onJumpBack} onJumpToPart={onJumpToPart} onJumpToTurn={onJumpToTurn}/>
          : <InspectorEmpty/>}
    </div>
  );
}

// Quiet empty state — the rail only describes its own purpose.
function InspectorEmpty() {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                  height:"100%", color:"var(--text-3)", textAlign:"center", padding:32, gap:14 }}>
      <div style={{ width:54, height:54, borderRadius:"50%", background:"var(--surface-2)", border:"1px dashed var(--border-strong)",
                     display:"flex", alignItems:"center", justifyContent:"center" }}>
        <Icon name="tool" size={22} style={{ color:"var(--text-4)" }}/>
      </div>
      <div>
        <div style={{ fontSize:13.5, fontWeight:600, color:"var(--text-2)" }}>Inspector</div>
        <div style={{ marginTop:4, fontSize:12, maxWidth:280, lineHeight:1.55 }}>
          Use <kbd style={{ fontFamily:"var(--font-mono)", fontSize:10.5, border:"1px solid var(--border)", padding:"0 5px", borderRadius:4, background:"var(--surface)" }}>j</kbd>/<kbd style={{ fontFamily:"var(--font-mono)", fontSize:10.5, border:"1px solid var(--border)", padding:"0 5px", borderRadius:4, background:"var(--surface)" }}>k</kbd> to browse turns,
          or click any tool capsule or diff to inspect arguments, results, and changes.
        </div>
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center", marginTop:4 }}>
        {["Bash","Read","Edit","Grep"].map(t => (
          <span key={t} style={{ fontFamily:"var(--font-mono)", fontSize:10.5, padding:"3px 8px",
            border:"1px solid var(--border)", borderRadius:99, color:"var(--text-3)", background:"var(--surface)" }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { RightRail, Minimap, TokensPanel, FilesPanel, InspectorEmpty, MessageInspector });
