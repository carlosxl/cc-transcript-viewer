// Session report — modal containing all session-scoped info that used
// to live as tabs in the right rail. Restores the Token consumption report
// from the previous design (Duration · Tool calls · Cache hit · Units +
// per-agent / per-model weight table), and adds Files + spike turns +
// usage-over-time chart so the right rail can become a pure contextual
// Inspector.

function ReportStatCard({ label, value, sub }) {
  return (
    <div style={{
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--r-2)", padding:"14px 16px",
      display:"flex", flexDirection:"column", gap:6, minWidth:0
    }}>
      <div style={{ fontSize:12, color:"var(--text-3)", fontWeight:500 }}>{label}</div>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:24, fontWeight:600, color:"var(--text)", lineHeight:1, letterSpacing:"-.01em" }}>{value}</div>
      <div style={{ fontSize:11, color:"var(--text-3)" }}>{sub}</div>
    </div>
  );
}

// Mini sparkline for usage-over-time
function ReportSparkline({ data, height=44 }) {
  const max = Math.max(...data, 1);
  const W = data.length * 8;
  const points = data.map((v, i) => `${i * 8 + 4},${height - 4 - (v / max) * (height - 12)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ width:"100%", height, display:"block" }}>
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="0" y1={height-2} x2={W} y2={height-2} stroke="var(--border)" strokeWidth=".5"/>
    </svg>
  );
}

function ReportTokenTable({ report }) {
  const cols = [
    { id:"agent",  label:"Agent",   sub:null,     align:"left",  w:62  },
    { id:"model",  label:"Model",   sub:null,     align:"left",  w:120 },
    { id:"input",  label:"Input",   sub:"1.0×",   align:"right", w:90  },
    { id:"c5",     label:"Cache 5m",sub:"1.25×",  align:"right", w:90  },
    { id:"c1h",    label:"Cache 1h",sub:"2.0×",   align:"right", w:90  },
    { id:"cRd",    label:"Cache rd",sub:"0.1×",   align:"right", w:90  },
    { id:"out",    label:"Output",  sub:null,     align:"right", w:80  },
    { id:"hit",    label:"Cache hit",sub:null,    align:"right", w:80  },
    { id:"units",  label:"Units",   sub:null,     align:"right", w:80  },
  ];
  const TH = ({ c }) => (
    <th style={{
      textAlign: c.align, padding:"10px 10px 8px", fontWeight:500,
      fontSize:11.5, color:"var(--text-3)", borderBottom:"1px solid var(--border)",
      whiteSpace:"nowrap", width:c.w
    }}>
      {c.label} {c.sub && <span style={{ color:"var(--text-4)", fontFamily:"var(--font-mono)", fontSize:10.5, fontWeight:400 }}>({c.sub})</span>}
    </th>
  );
  const cell = (align) => ({
    padding:"12px 10px", textAlign: align, verticalAlign:"top",
    borderBottom:"1px solid var(--border-subtle)"
  });
  const numCell = (align, raw, weight) => (
    <td style={cell(align)}>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--text)" }}>{raw}</div>
      {weight && <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)", marginTop:2 }}>{weight}</div>}
    </td>
  );
  return (
    <div style={{ border:"1px solid var(--border)", borderRadius:"var(--r-2)", background:"var(--surface)", overflow:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", minWidth:780 }}>
        <thead>
          <tr style={{ background:"var(--surface-2)" }}>
            {cols.map(c => <TH key={c.id} c={c}/>)}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((r, i) => (
            <tr key={i}>
              <td style={cell("left")}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:600, color:"var(--text)" }}>{r.agent}</div>
              </td>
              <td style={cell("left")}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--text)" }}>{r.model}</div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)", marginTop:2 }}>{r.calls}</div>
              </td>
              {numCell("right", r.input.raw, r.input.weight)}
              {numCell("right", r.c5.raw, r.c5.weight)}
              {numCell("right", r.c1h.raw, r.c1h.weight)}
              {numCell("right", r.cRd.raw, r.cRd.weight)}
              {numCell("right", r.out.raw, r.out.weight)}
              <td style={cell("right")}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--text)" }}>{r.hit}</div>
              </td>
              <td style={cell("right")}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:600, color:"var(--text)" }}>{r.units}</div>
              </td>
            </tr>
          ))}
          <tr style={{ background:"var(--surface-2)" }}>
            <td colSpan={2} style={{ ...cell("left"), borderBottom:"none" }}>
              <div style={{ fontSize:12, color:"var(--text-2)", fontWeight:500 }}>Units by usage type</div>
            </td>
            <td style={{ ...cell("right"), borderBottom:"none" }}><span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:600 }}>{report.totals.input}</span></td>
            <td style={{ ...cell("right"), borderBottom:"none" }}><span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:600 }}>{report.totals.c5}</span></td>
            <td style={{ ...cell("right"), borderBottom:"none" }}><span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:600 }}>{report.totals.c1h}</span></td>
            <td style={{ ...cell("right"), borderBottom:"none" }}><span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:600 }}>{report.totals.cRd}</span></td>
            <td style={{ ...cell("right"), borderBottom:"none" }}><span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:600 }}>{report.totals.out}</span></td>
            <td style={{ ...cell("right"), borderBottom:"none" }}><span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:600 }}>{report.totals.hit}</span></td>
            <td style={{ ...cell("right"), borderBottom:"none" }}><span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700 }}>{report.totals.units}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ReportSection({ title, action, children }) {
  return (
    <section style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
        <h3 style={{ margin:0, fontSize:13, fontWeight:600, color:"var(--text)", letterSpacing:".01em", textTransform:"uppercase" }}>{title}</h3>
        <span style={{ flex:1, height:1, background:"var(--border)" }}/>
        {action}
      </div>
      {children}
    </section>
  );
}

function ReportFileRow({ f, onJump }) {
  // Spread reads/writes across a fixed timeline
  const events = [];
  for (let i = 0; i < f.reads;  i++) events.push({ t: 8 + i * 18 + Math.random()*4, kind:"r" });
  for (let i = 0; i < f.writes; i++) events.push({ t: 58 + i * 14 + Math.random()*4, kind:"w" });
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"10px 14px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
        <Icon name="code" size={13} style={{ color:"var(--text-3)" }}/>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:12.5, color:"var(--text)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.path}</span>
        {f.changed && <span style={{ fontSize:10, color:"var(--diff-add-text)", background:"var(--diff-add-bg)", padding:"2px 6px", borderRadius:4, fontWeight:600, letterSpacing:".03em" }}>CHANGED</span>}
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)" }}>
          {f.reads}r · {f.writes}w {f.lines && `· L ${f.lines}`}
        </span>
      </div>
      <div style={{ position:"relative", height:10, background:"var(--surface-3)", borderRadius:99 }}>
        {events.map((e, i) => (
          <div key={i} onClick={onJump} title={`${e.kind === "r" ? "Read" : "Write"} ~m${Math.floor(e.t)}`}
            style={{
              position:"absolute", left:`${Math.min(e.t, 96)}%`, top:0, width:8, height:10,
              background: e.kind === "w" ? "var(--accent)" : "var(--user-rail)",
              borderRadius:2, cursor:"pointer"
            }}/>
        ))}
      </div>
    </div>
  );
}

function SessionReport({ open, onClose, session: _ignored, onJumpToTurn }) {
  const session = WS_ACTIVE;
  const report = TOKEN_REPORT;
  const trend = React.useMemo(
    () => Array.from({length: 28}, (_, i) => Math.floor(40 + Math.random() * 90 + (i > 10 ? 50 : 0))),
    []
  );
  // ESC to close
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(20,18,14,.42)",
      backdropFilter:"blur(2px)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 20px"
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:"min(960px, 100%)", maxHeight:"calc(100vh - 80px)",
        background:"var(--surface)", border:"1px solid var(--border-strong)",
        borderRadius:"var(--r-3)", boxShadow:"var(--shadow-lg)",
        display:"flex", flexDirection:"column", overflow:"hidden"
      }}>
        {/* Header */}
        <div style={{ padding:"18px 22px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"flex-start", gap:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, color:"var(--text-3)", fontFamily:"var(--font-mono)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>
              Session report
            </div>
            <h2 style={{ margin:0, fontSize:18, fontWeight:600, color:"var(--text)", lineHeight:1.3,
                         overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {session.shortTitle || session.title}
            </h2>
            <div style={{ marginTop:5, fontSize:12, color:"var(--text-3)" }}>
              Tokens grouped by agent and model. Units are model-relative weights (not USD) — stable across price changes.
            </div>
          </div>
          <button onClick={onClose} className="cc-icon-btn" style={{ padding:6 }} aria-label="Close">
            <Icon name="x" size={14}/>
          </button>
        </div>

        {/* Body */}
        <div className="scroll" style={{ flex:1, overflow:"auto", padding:"20px 22px 24px", background:"var(--surface-inset)" }}>
          <div style={{ display:"grid", gap:22 }}>

            {/* Headline stats — matches the previous design 1:1 */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12 }}>
              <ReportStatCard label="Duration"       value={report.duration}    sub="first → last turn"/>
              <ReportStatCard label="Tool calls"     value={report.toolCalls.total}
                              sub={`main ${report.toolCalls.main} · sub ${report.toolCalls.sub}`}/>
              <ReportStatCard label="Cache hit rate" value={report.cacheHit}    sub="read / (read + create + input)"/>
              <ReportStatCard label="Total units"    value={report.totalUnits}  sub="weighted, all agents"/>
            </div>

            {/* Token consumption table */}
            <ReportSection
              title="By agent & model"
              action={
                <button className="cc-icon-btn" style={{ padding:"4px 10px" }}>
                  <Icon name="download" size={12}/> Export CSV
                </button>
              }>
              <ReportTokenTable report={report}/>
              <div style={{ fontSize:11, color:"var(--text-3)", lineHeight:1.55 }}>
                The first number in each cell is the raw token count; the smaller number is the weighted unit cost
                (input ×1.0 · cache 5m ×1.25 · cache 1h ×2.0 · cache read ×0.1).
              </div>
            </ReportSection>

            {/* Usage over time */}
            <ReportSection title="Usage over time">
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8 }}>
                  <div style={{ fontSize:12, color:"var(--text-2)" }}>Units per turn · 28 turns</div>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)" }}>peak m17 · 412K</div>
                </div>
                <ReportSparkline data={trend}/>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                <SpikeMini turn="m17" cost="412K" reason="Read 18 files"/>
                <SpikeMini turn="m41" cost="289K" reason="Long Bash output"/>
                <SpikeMini turn="m83" cost="221K" reason="Diff over 412-line file"/>
              </div>
            </ReportSection>

            {/* Files touched */}
            <ReportSection title={`Files touched · ${session.files.length}`}>
              <div style={{ display:"grid", gap:8 }}>
                {session.files.map((f, i) => <ReportFileRow key={i} f={f} onJump={onJumpToTurn}/>)}
              </div>
            </ReportSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpikeMini({ turn, cost, reason }) {
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"10px 12px" }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:12, fontWeight:600, color:"var(--accent-text)" }}>{turn}</span>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:12, fontWeight:600, color:"var(--text)", marginLeft:"auto" }}>{cost}</span>
      </div>
      <div style={{ fontSize:11.5, color:"var(--text-3)" }}>{reason}</div>
    </div>
  );
}

Object.assign(window, { SessionReport });
