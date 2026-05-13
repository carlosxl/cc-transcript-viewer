// Variation 3 — "Timeline"
// A single-column timeline that treats the transcript as a vertical
// sequence of events along a center spine. Strong visual rhythm —
// avatars on alternating sides, tool events as compact mid-line nodes.
// Session navigator sits at the top as a horizontal carousel; details
// for a turn pop into an inline drawer rather than a side rail.

function V3Timeline({ theme, onTheme }) {
  const [openMsg, setOpenMsg] = React.useState({ "m5":true, "m8":true });
  const [mode, setMode] = React.useState("details");
  const [reportOpen, setReportOpen] = React.useState(true); // shown by default — anchor of variation
  const activeSession = SESSIONS.find(s => s.active);

  return (
    <div className="cc-mock" data-theme={theme} style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--bg)" }}>
      {/* ─────────── Top bar ─────────── */}
      <header style={{ borderBottom:"1px solid var(--border)", background:"var(--surface)", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", padding:"10px 20px", gap:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:24, height:24, borderRadius:7, background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" }}>
              <Icon name="terminal" size={14} stroke={2}/>
            </div>
            <span style={{ fontWeight:600, fontSize:14, letterSpacing:"-.01em" }}>Transcript</span>
            <span style={{ fontSize:11.5, color:"var(--text-3)", padding:"2px 6px", borderRadius:4, background:"var(--surface-2)", fontFamily:"var(--font-mono)" }}>{ACTIVE.project}</span>
          </div>
          <div style={{ flex:1 }}/>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text-3)" }}>
              <Icon name="search" size={13}/>
            </span>
            <input placeholder="Search transcripts" style={{ width:240, padding:"6px 12px 6px 30px", border:"1px solid var(--border)", borderRadius:"var(--r-pill)",
                    background:"var(--surface-inset)", color:"var(--text)", fontSize:12.5, fontFamily:"inherit", outline:"none" }}/>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:2, padding:2, background:"var(--surface-inset)", border:"1px solid var(--border)", borderRadius:"var(--r-pill)" }}>
            {["compact","details"].map(m =>
              <button key={m} onClick={() => setMode(m)}
                style={{ padding:"4px 12px", borderRadius:"var(--r-pill)", border:"none", cursor:"pointer",
                        background: mode===m ? "var(--surface)" : "transparent", color: mode===m ? "var(--text)" : "var(--text-3)",
                        fontSize:11.5, fontFamily:"inherit", boxShadow: mode===m ? "var(--shadow-sm)" : "none", fontWeight: mode===m ? 500 : 400 }}>
                {m === "compact" ? "Compact" : "Details"}
              </button>)}
          </div>
          <ThemeToggle theme={theme} onChange={onTheme}/>
        </div>

        {/* Session carousel */}
        <div style={{ borderTop:"1px solid var(--border-subtle)", padding:"8px 12px", display:"flex", alignItems:"center", gap:6, overflow:"hidden" }}>
          <button style={{ background:"transparent", border:"none", padding:6, borderRadius:6, cursor:"pointer", color:"var(--text-3)", flexShrink:0 }}>
            <Icon name="chevron-left" size={14}/>
          </button>
          <div className="scroll" style={{ display:"flex", gap:8, overflowX:"auto", flex:1, scrollSnapType:"x mandatory" }}>
            {SESSIONS.slice(0, 8).map(s => (
              <div key={s.id} style={{
                flex:"0 0 auto", scrollSnapAlign:"start", padding:"7px 12px", borderRadius:8,
                border: s.active ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: s.active ? "var(--accent-soft)" : "var(--surface-inset)",
                maxWidth:220, cursor:"pointer", position:"relative"
              }}>
                {s.active && <span style={{ position:"absolute", top:6, right:6, width:6, height:6, borderRadius:3, background:"var(--accent)" }}/>}
                <div style={{ fontSize:11.5, lineHeight:1.35, color: s.active ? "var(--accent-text)" : "var(--text-2)",
                              fontWeight: s.active ? 500 : 400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                              paddingRight: s.active ? 14 : 0 }}>{s.title}</div>
                <div style={{ display:"flex", gap:8, marginTop:2, fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)" }}>
                  <span>{s.ago}</span><span>·</span><span>{s.msgs}msg</span><span>·</span><span>{s.cost}</span>
                </div>
              </div>
            ))}
            <button style={{ flex:"0 0 auto", padding:"7px 12px", border:"1px dashed var(--border-strong)", borderRadius:8, background:"transparent", cursor:"pointer", color:"var(--text-3)", fontFamily:"inherit", fontSize:12 }}>
              All sessions ({SESSIONS.length})
            </button>
          </div>
          <button style={{ background:"transparent", border:"none", padding:6, borderRadius:6, cursor:"pointer", color:"var(--text-3)", flexShrink:0 }}>
            <Icon name="chevron-right" size={14}/>
          </button>
        </div>
      </header>

      <div style={{ flex:1, display:"flex", minHeight:0 }}>
        {/* ─────────── Main timeline ─────────── */}
        <main className="scroll" style={{ flex:1, overflowY:"auto" }}>
          <div style={{ maxWidth:960, margin:"0 auto", padding:"32px 32px 60px" }}>
            {/* Session title block */}
            <div style={{ marginBottom:30 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, color:"var(--text-3)", fontSize:11.5, marginBottom:6, fontFamily:"var(--font-mono)" }}>
                <span>session</span>
                <span>·</span>
                <span>{ACTIVE.started}</span>
                <span>·</span>
                <span>{ACTIVE.duration}</span>
                <span>·</span>
                <span>{ACTIVE.model}</span>
              </div>
              <h1 style={{ margin:0, fontSize:24, fontWeight:500, lineHeight:1.3, letterSpacing:"-.015em",
                            fontFamily:"var(--font-serif)", color:"var(--text)" }}>
                {ACTIVE.title}
              </h1>
            </div>

            {/* Timeline */}
            <div style={{ position:"relative", paddingLeft:28 }}>
              {/* Spine */}
              <div style={{ position:"absolute", left:11, top:8, bottom:8, width:2, background:"var(--border)", borderRadius:1 }}/>
              {MESSAGES.map((m, i) => (
                <V3Node key={m.id} m={m} mode={mode} open={openMsg[m.id]}
                        onToggle={() => setOpenMsg(o => ({ ...o, [m.id]: !o[m.id] }))} idx={i}/>
              ))}
              {/* End cap */}
              <div style={{ position:"relative", marginTop:8 }}>
                <div style={{ position:"absolute", left:-22, top:6, width:10, height:10, borderRadius:5, background:"var(--surface)", border:"2px solid var(--border-strong)" }}/>
                <div style={{ fontSize:12, color:"var(--text-3)", fontFamily:"var(--font-mono)" }}>session end · {ACTIVE.duration}</div>
              </div>
            </div>
          </div>
        </main>

        {/* ─────────── Persistent token report rail ─────────── */}
        {reportOpen && (
          <aside style={{ width:340, flex:"0 0 340px", borderLeft:"1px solid var(--border)", background:"var(--surface)", display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"14px 18px 12px", display:"flex", alignItems:"flex-start", gap:8, borderBottom:"1px solid var(--border)" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"var(--font-serif)", fontSize:18, fontWeight:500 }}>Token report</div>
                <div style={{ fontSize:11.5, color:"var(--text-3)", marginTop:2, lineHeight:1.4 }}>Model-relative weights, stable across price changes.</div>
              </div>
              <button onClick={() => setReportOpen(false)} style={{ background:"transparent", border:"none", padding:5, borderRadius:6, cursor:"pointer", color:"var(--text-3)" }}>
                <Icon name="close" size={14}/>
              </button>
            </div>

            <div className="scroll" style={{ flex:1, overflowY:"auto", padding:"16px 18px 20px" }}>
              {/* Headline stat */}
              <div style={{ padding:"14px 16px", border:"1px solid var(--accent)30", borderRadius:10, background:"var(--accent-soft)" }}>
                <div style={{ fontSize:11, color:"var(--accent-text)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500 }}>Total units · weighted</div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:32, fontWeight:500, color:"var(--accent-text)", lineHeight:1.1, marginTop:4 }}>{TOKEN_REPORT.totalUnits}</div>
                <div style={{ fontSize:11.5, color:"var(--accent-text)", opacity:.75, marginTop:4 }}>~ 1 unit ≈ 1 input token equivalent</div>
              </div>

              {/* Secondary stats */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10 }}>
                <V3Stat label="Cache hit" value={TOKEN_REPORT.cacheHit} tone="success"/>
                <V3Stat label="Tool calls" value={TOKEN_REPORT.toolCalls.total}/>
                <V3Stat label="Duration" value={TOKEN_REPORT.duration} mono/>
                <V3Stat label="Model" value="opus-4.7" mono/>
              </div>

              {/* Donut breakdown */}
              <div style={{ marginTop:18 }}>
                <div style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500, marginBottom:8 }}>By usage type</div>
                <V3Donut/>
              </div>

              {/* Raw table */}
              <div style={{ marginTop:18 }}>
                <div style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500, marginBottom:6 }}>Raw</div>
                <div style={{ border:"1px solid var(--border)", borderRadius:8, overflow:"hidden" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"var(--font-mono)", fontSize:11 }}>
                    <tbody>
                      {[
                        { l:"input", r:"93", w:"1.4ku" },
                        { l:"cache 5m", r:"0", w:"0u" },
                        { l:"cache 1h", r:"207.3k", w:"6.2mu" },
                        { l:"cache read", r:"4.9m", w:"7.4mu" },
                        { l:"output", r:"19.6k", w:"1.5mu" },
                      ].map((row, i) => (
                        <tr key={i} style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                          <td style={{ padding:"7px 12px", color:"var(--text-3)" }}>{row.l}</td>
                          <td style={{ padding:"7px 4px", textAlign:"right", color:"var(--text)" }}>{row.r}</td>
                          <td style={{ padding:"7px 12px", textAlign:"right", color:"var(--accent-text)" }}>{row.w}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button style={{ marginTop:14, width:"100%", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, padding:"8px 12px",
                       border:"1px solid var(--border)", borderRadius:8, background:"var(--surface)", color:"var(--text-2)",
                       cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>
                <Icon name="download" size={12}/> Export CSV
              </button>
            </div>
          </aside>
        )}
        {!reportOpen && (
          <button onClick={() => setReportOpen(true)}
            style={{ position:"absolute", right:16, top:120, display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px",
                     border:"1px solid var(--border)", borderRadius:"var(--r-pill)", background:"var(--surface)",
                     boxShadow:"var(--shadow-sm)", cursor:"pointer", color:"var(--text-2)", fontFamily:"inherit", fontSize:12 }}>
            <Icon name="chart" size={12}/> Token report
          </button>
        )}
      </div>
    </div>
  );
}

function V3Node({ m, mode, open, onToggle }) {
  const isUser = m.role === "user";
  const role = isUser ? "user" : "assistant";
  // Compute a one-line summary for collapsed turns
  const summary = isUser
    ? (m.kind === "command" ? m.name : m.kind === "stderr" ? "stderr from prior tool" : m.text)
    : (m.parts.find(p => p.type === "text")?.text || `${m.parts.filter(p=>p.type==="tool").length} tool call${m.parts.filter(p=>p.type==="tool").length===1?"":"s"}`);

  return (
    <div style={{ position:"relative", marginBottom:18 }}>
      {/* Node dot */}
      <div style={{ position:"absolute", left:-22, top:6,
                    width:18, height:18, borderRadius:9,
                    background: isUser ? "var(--user-tint)" : "var(--claude-tint)",
                    border: `2px solid ${isUser ? "var(--user-rail)" : "var(--claude-rail)"}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color: isUser ? "var(--user-text)" : "var(--claude-text)" }}>
        <Icon name={isUser ? "user" : "bot"} size={9} stroke={2}/>
      </div>

      <button onClick={onToggle}
        style={{ display:"flex", alignItems:"baseline", gap:10, padding:"0 0 6px", background:"transparent",
                 border:"none", cursor:"pointer", fontFamily:"inherit", textAlign:"left", width:"100%" }}>
        <span style={{ fontSize:12.5, fontWeight:600, color: isUser ? "var(--user-text)" : "var(--claude-text)" }}>
          {isUser ? "You" : "Claude"}
        </span>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)" }}>{m.at}</span>
        {!isUser && <span style={{ fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)" }}>opus-4.7</span>}
        <span style={{ flex:1 }}/>
        <Icon name="chevron-down" size={12} style={{ color:"var(--text-3)", transform: open ? "none" : "rotate(-90deg)", transition:"transform .15s" }}/>
      </button>

      {/* Collapsed: one-liner */}
      {!open && (
        <div style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.5, overflow:"hidden", textOverflow:"ellipsis",
                      whiteSpace:"nowrap", maxWidth:"100%" }}>
          {summary}
        </div>
      )}

      {/* Expanded */}
      {open && (
        <div>
          {isUser && <V3UserBody m={m}/>}
          {!isUser && m.parts.map((p, i) => {
            if (p.type === "text")  return <p key={i} style={{ margin:"6px 0", fontSize:14, lineHeight:1.6, color:"var(--text)" }}><RichText text={p.text}/></p>;
            if (p.type === "think" && mode !== "compact") return (
              <div key={i} style={{ display:"flex", gap:8, padding:"8px 12px", borderRadius:8, background:"var(--think-tint)", margin:"6px 0" }}>
                <Icon name="spark" size={12} style={{ color:"var(--text-3)", marginTop:3, flexShrink:0 }}/>
                <div style={{ fontSize:12.5, color:"var(--think-text)", fontStyle:"italic", lineHeight:1.55 }}>{p.text}</div>
              </div>
            );
            if (p.type === "diff") return <div key={i} style={{ margin:"8px 0" }}><DiffBlock {...p}/></div>;
            if (p.type === "tool") return <V3ToolNode key={i} part={p}/>;
            return null;
          })}
        </div>
      )}
    </div>
  );
}

function V3UserBody({ m }) {
  if (m.kind === "command") {
    return (
      <div style={{ padding:"8px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-inset)",
                    display:"flex", alignItems:"flex-start", gap:10 }}>
        <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"2px 9px", borderRadius:"var(--r-pill)",
                       background:"var(--accent-soft)", color:"var(--accent-text)", fontFamily:"var(--font-mono)",
                       fontSize:11.5, fontWeight:500, flexShrink:0, marginTop:1 }}>
          <Icon name="command" size={10}/> {m.name}
        </span>
        {m.args && <span style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.55 }}>{m.args}</span>}
      </div>
    );
  }
  if (m.kind === "stderr") {
    return (
      <div style={{ padding:"10px 12px", borderRadius:8, background:"var(--danger-soft)", border:"1px solid var(--danger)30",
                    fontFamily:"var(--font-mono)", fontSize:11.5, color:"var(--danger)", whiteSpace:"pre-wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, fontFamily:"var(--font-sans)", fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:".06em" }}>
          <Icon name="warn" size={11}/> stderr from prior tool
        </div>
        {m.text}
      </div>
    );
  }
  return <p style={{ margin:0, fontSize:14, lineHeight:1.6, color:"var(--text)" }}>{m.text}</p>;
}

function V3ToolNode({ part }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ margin:"8px 0", borderLeft:"2px solid var(--tool-rail)", paddingLeft:12 }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 10px", borderRadius:6,
                 background:"var(--surface-2)", border:"1px solid var(--border)", cursor:"pointer",
                 fontFamily:"inherit", width:"100%", textAlign:"left" }}>
        <Icon name="tool" size={11} style={{ color:"var(--tool-text)" }}/>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11.5, fontWeight:500, color:"var(--text)" }}>{part.tool}</span>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)",
                       flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {part.args.command ?? part.args.file_path ?? part.args.description}
        </span>
        {part.async && (
          <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:10, color:"var(--info)", background:"var(--info-soft)", padding:"0 6px", borderRadius:3 }}>
            <Icon name="spinner" size={9}/> bg
          </span>
        )}
        {part.tokens && <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-3)" }}>{part.tokens}t</span>}
        <Icon name="chevron-down" size={11} style={{ color:"var(--text-3)", transform: open ? "none" : "rotate(-90deg)", transition:"transform .15s" }}/>
      </button>
      {open && (
        <div style={{ marginTop:6 }}>
          {part.args.command && <CodeBlock language="bash" code={part.args.command} lineNumbers={false} dense/>}
          {part.args.file_path && (
            <div style={{ padding:"6px 10px", border:"1px solid var(--code-border)", borderRadius:6, background:"var(--code-bg)", fontFamily:"var(--font-mono)", fontSize:11.5, color:"var(--text-2)", display:"flex", alignItems:"center", gap:6 }}>
              <Icon name="folder" size={11} style={{ color:"var(--text-3)" }}/>{part.args.file_path}
            </div>
          )}
          {part.result && <div style={{ marginTop:6 }}><CodeBlock code={part.result} lineNumbers={false} dense/></div>}
        </div>
      )}
    </div>
  );
}

function V3Stat({ label, value, tone, mono }) {
  return (
    <div style={{ padding:"10px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-inset)" }}>
      <div style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500 }}>{label}</div>
      <div style={{ fontFamily:mono ? "var(--font-mono)" : "var(--font-mono)", fontSize:16, fontWeight:500, marginTop:3,
                   color: tone==="success" ? "var(--success)" : "var(--text)" }}>{value}</div>
    </div>
  );
}

function V3Donut() {
  const segs = [
    { label:"cache read", v:7.4, color:"#A8C28E" },
    { label:"cache 1h",   v:6.2, color:"#D8A557" },
    { label:"output",     v:1.5, color:"var(--accent)" },
    { label:"input",      v:1.4, color:"#7AA0C2" },
  ];
  const total = segs.reduce((s, x) => s + x.v, 0);
  let acc = 0;
  const r = 36, c = 50, C = 2 * Math.PI * r;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="14"/>
        {segs.map((s, i) => {
          const len = (s.v/total) * C;
          const el = <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={s.color} strokeWidth="14"
                              strokeDasharray={`${len} ${C-len}`} strokeDashoffset={-acc} transform={`rotate(-90 ${c} ${c})`}/>;
          acc += len;
          return el;
        })}
        <text x={c} y={c-1} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontFamily="var(--font-mono)" fontWeight="500" fill="var(--text)">15.1m</text>
        <text x={c} y={c+12} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontFamily="var(--font-sans)" fill="var(--text-3)">units</text>
      </svg>
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:5 }}>
        {segs.map(s => (
          <div key={s.label} style={{ display:"flex", alignItems:"center", gap:7, fontSize:11.5 }}>
            <span style={{ width:9, height:9, borderRadius:2, background:s.color, flexShrink:0 }}/>
            <span style={{ flex:1, color:"var(--text-2)" }}>{s.label}</span>
            <span style={{ fontFamily:"var(--font-mono)", color:"var(--text-3)" }}>{s.v}mu</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { V3Timeline });
