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

// ── Right rail container with tabs ───────────────────────────────
function RightRail({ activePart, activeDiff, onJumpBack, onClose, session, onJumpToTurn, forceTab, onTabChange }) {
  const [tab, setTab] = React.useState("inspector");
  React.useEffect(() => {
    if (activePart || activeDiff) setTab("inspector");
  }, [activePart, activeDiff]);
  React.useEffect(() => { if (forceTab) { setTab(forceTab); onTabChange?.(forceTab); } }, [forceTab]);

  const TabBtn = ({ id, icon, label, count }) => (
    <button onClick={() => setTab(id)} style={{
      flex:1, padding:"9px 8px", fontSize:11.5, fontWeight: tab===id ? 600 : 500,
      color: tab===id ? "var(--text)" : "var(--text-3)",
      background: tab===id ? "var(--surface)" : "transparent",
      border:"none", borderBottom: tab===id ? "2px solid var(--accent)" : "2px solid transparent",
      cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:5, fontFamily:"inherit"
    }}>
      <Icon name={icon} size={12}/>{label}
      {count != null && <span style={{ fontSize:10, color:"var(--text-3)", fontFamily:"var(--font-mono)" }}>{count}</span>}
    </button>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--surface)", borderLeft:"1px solid var(--border)" }}>
      <div style={{ display:"flex", borderBottom:"1px solid var(--border)", background:"var(--surface-2)" }}>
        <TabBtn id="inspector" icon="tool" label="Inspector"/>
        <TabBtn id="tokens" icon="chart" label="Tokens"/>
        <TabBtn id="files" icon="folder" label="Files" count={WS_ACTIVE.files.length}/>
      </div>
      {tab === "inspector" && <Inspector part={activePart} diff={activeDiff} onJumpBack={onJumpBack} onClose={onClose}/>}
      {tab === "tokens"    && <TokensPanel session={session}/>}
      {tab === "files"     && <FilesPanel session={session} onJumpToTurn={onJumpToTurn}/>}
    </div>
  );
}

Object.assign(window, { RightRail, Minimap, TokensPanel, FilesPanel });
