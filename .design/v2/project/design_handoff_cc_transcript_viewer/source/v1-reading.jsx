// Variation 1 — "Reading view"
// A document-like transcript with editorial whitespace, sticky session
// header, a collapsible left rail of sessions grouped by project, and
// tool calls collapsed into pill-shaped capsules that expand inline.
//
// Vibe: Substack/Linear hybrid. Quiet by default, dense on demand.

function V1Reading({ theme, onTheme }) {
  const [collapseRail, setCollapseRail] = React.useState(false);
  const [openTool, setOpenTool] = React.useState({ "m5-1": true, "m8-1": true, "m8-2": true });
  const [openReport, setOpenReport] = React.useState(false);
  const [filter, setFilter] = React.useState("");
  const [mode, setMode] = React.useState("details"); // details | compact

  const sessionsByProject = React.useMemo(() => {
    const g = {};
    SESSIONS.filter(s => !filter || s.title.toLowerCase().includes(filter.toLowerCase())).forEach(s => {
      (g[s.project] ||= []).push(s);
    });
    return g;
  }, [filter]);

  return (
    <div className="cc-mock" data-theme={theme} style={{ width:"100%", height:"100%", display:"flex", overflow:"hidden", background:"var(--bg)" }}>
      {/* ─────────── Left rail: sessions ─────────── */}
      <aside style={{
        width: collapseRail ? 56 : 320, flex:`0 0 ${collapseRail ? 56 : 320}px`,
        borderRight:"1px solid var(--border)", background:"var(--surface-inset)",
        display:"flex", flexDirection:"column", transition:"width .2s ease"
      }}>
        {/* Brand + collapse */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding: collapseRail ? "16px 12px" : "16px 20px", height:60, borderBottom:"1px solid var(--border)" }}>
          {!collapseRail && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:24, height:24, borderRadius:7, background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" }}>
                <Icon name="terminal" size={14} stroke={2}/>
              </div>
              <span style={{ fontWeight:600, fontSize:14, letterSpacing:"-.01em" }}>Transcript</span>
            </div>
          )}
          <button onClick={() => setCollapseRail(v => !v)}
                  style={{ background:"transparent", border:"none", padding:6, borderRadius:6, cursor:"pointer", color:"var(--text-3)" }}
                  title="Collapse">
            <Icon name="side" size={14}/>
          </button>
        </div>

        {!collapseRail && (
          <>
            {/* Search */}
            <div style={{ padding:"12px 16px 8px" }}>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text-3)", display:"flex" }}>
                  <Icon name="search" size={13}/>
                </span>
                <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search sessions"
                       style={{ width:"100%", padding:"7px 10px 7px 30px", border:"1px solid var(--border)", borderRadius:8,
                                background:"var(--surface)", color:"var(--text)", fontSize:12.5, fontFamily:"inherit", outline:"none" }}/>
              </div>
              <div style={{ display:"flex", gap:6, marginTop:8 }}>
                {["All","Pinned","Today","7d"].map((t, i) =>
                  <button key={t} style={{ padding:"3px 8px", borderRadius:6, border:"1px solid var(--border)",
                          background: i===0 ? "var(--surface)" : "transparent", color: i===0 ? "var(--text)" : "var(--text-3)",
                          fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{t}</button>)}
              </div>
            </div>

            {/* Session list */}
            <div className="scroll" style={{ flex:1, overflowY:"auto", padding:"4px 8px 16px" }}>
              {Object.entries(sessionsByProject).map(([proj, list]) => (
                <div key={proj} style={{ marginTop:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 12px 6px", color:"var(--text-3)", fontSize:11, textTransform:"uppercase", letterSpacing:".06em", fontWeight:500 }}>
                    <Icon name="folder" size={11}/>
                    <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{proj}</span>
                    <span style={{ fontFamily:"var(--font-mono)", textTransform:"none", letterSpacing:0 }}>{list.length}</span>
                  </div>
                  {list.map(s => (
                    <div key={s.id} style={{
                        padding:"9px 12px", borderRadius:8, cursor:"pointer", marginBottom:2,
                        background: s.active ? "var(--surface)" : "transparent",
                        boxShadow: s.active ? "var(--shadow-sm)" : "none",
                        position:"relative"
                    }}>
                      {s.active && <div style={{ position:"absolute", left:-8, top:8, bottom:8, width:3, borderRadius:2, background:"var(--accent)" }}/>}
                      <div style={{ display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden",
                                    fontSize:12.5, lineHeight:1.4, color: s.active ? "var(--text)" : "var(--text-2)",
                                    fontWeight: s.active ? 500 : 400 }}>
                        {s.title}
                      </div>
                      <div style={{ display:"flex", gap:8, marginTop:4, alignItems:"center", color:"var(--text-3)", fontSize:11 }}>
                        <span>{s.ago}</span>
                        <span style={{ width:2, height:2, borderRadius:1, background:"var(--text-4)" }}/>
                        <span style={{ fontFamily:"var(--font-mono)" }}>{s.msgs}</span>
                        <span style={{ fontFamily:"var(--font-mono)", marginLeft:"auto", color:"var(--text-3)" }}>{s.cost}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </aside>

      {/* ─────────── Main column ─────────── */}
      <main style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column" }}>
        {/* Sticky session header */}
        <header style={{ position:"sticky", top:0, zIndex:5, background:"var(--bg)", borderBottom:"1px solid var(--border)" }}>
          <div style={{ padding:"14px 32px 12px", display:"flex", alignItems:"flex-start", gap:20 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, color:"var(--text-3)", fontSize:11, marginBottom:4 }}>
                <Icon name="folder" size={11}/>
                <span style={{ fontFamily:"var(--font-mono)" }}>{ACTIVE.project}</span>
                <span style={{ width:2, height:2, borderRadius:1, background:"var(--text-4)" }}/>
                <span>{ACTIVE.started}</span>
                <span style={{ width:2, height:2, borderRadius:1, background:"var(--text-4)" }}/>
                <span>{ACTIVE.duration}</span>
                <span style={{ width:2, height:2, borderRadius:1, background:"var(--text-4)" }}/>
                <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"1px 6px", borderRadius:4, background:"var(--surface-2)", color:"var(--text-2)", fontFamily:"var(--font-mono)" }}>{ACTIVE.model}</span>
              </div>
              <h1 style={{ margin:0, fontSize:21, fontWeight:600, lineHeight:1.3, letterSpacing:"-.015em",
                           fontFamily:"var(--font-serif)", color:"var(--text)",
                           display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                {ACTIVE.title}
              </h1>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:3, padding:3, background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-pill)" }}>
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
          </div>
          {/* Token strip — always visible, dense */}
          <div style={{ padding:"0 32px 12px", display:"flex", alignItems:"center", gap:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:24, padding:"10px 16px",
                          background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, flex:1 }}>
              <MetricChip label="Input" value={ACTIVE.metrics.in} mono dense/>
              <span style={{ width:1, height:16, background:"var(--border)" }}/>
              <MetricChip label="Output" value={ACTIVE.metrics.out} mono dense/>
              <span style={{ width:1, height:16, background:"var(--border)" }}/>
              <MetricChip label="Cache write" value={ACTIVE.metrics.cachePlus} mono dense/>
              <span style={{ width:1, height:16, background:"var(--border)" }}/>
              <MetricChip label="Cache read" value={ACTIVE.metrics.cacheMinus} mono dense/>
              <span style={{ width:1, height:16, background:"var(--border)" }}/>
              <div style={{ display:"inline-flex", alignItems:"baseline", gap:6 }}>
                <span style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500 }}>Cache hit</span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:500, color:"var(--success)" }}>{ACTIVE.metrics.hit}</span>
                <div style={{ width:48, height:5, borderRadius:3, background:"var(--surface-2)", overflow:"hidden", marginLeft:4 }}>
                  <div style={{ width:"100%", height:"100%", background:"var(--success)" }}/>
                </div>
              </div>
              <button onClick={() => setOpenReport(true)}
                  style={{ marginLeft:"auto", display:"inline-flex", alignItems:"center", gap:6, padding:"5px 12px",
                           border:"1px solid var(--border)", borderRadius:"var(--r-pill)", background:"var(--bg)",
                           cursor:"pointer", color:"var(--text-2)", fontFamily:"inherit", fontSize:12 }}>
                <Icon name="chart" size={12}/> Token report
              </button>
            </div>
          </div>
        </header>

        {/* Conversation */}
        <div className="scroll" style={{ flex:1, overflowY:"auto" }}>
          <div style={{ maxWidth:880, margin:"0 auto", padding:"32px 32px 80px" }}>
            {MESSAGES.map((m, idx) => <V1Turn key={m.id} m={m} mode={mode} openTool={openTool} setOpenTool={setOpenTool} isFirst={idx===0}/>)}
            <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:24, color:"var(--text-3)", fontSize:12 }}>
              <div style={{ flex:1, height:1, background:"var(--border)" }}/>
              <span>End of session · {ACTIVE.duration}</span>
              <div style={{ flex:1, height:1, background:"var(--border)" }}/>
            </div>
          </div>
        </div>
      </main>

      {openReport && <V1TokenReport onClose={() => setOpenReport(false)}/>}
    </div>
  );
}

function V1Turn({ m, mode, openTool, setOpenTool }) {
  const isUser = m.role === "user";
  return (
    <article style={{ marginBottom: 28, scrollMarginTop: 120 }}>
      {/* Speaker row */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
        <div style={{
          width:24, height:24, borderRadius:"50%",
          background: isUser ? "var(--user-tint)" : "var(--claude-tint)",
          color: isUser ? "var(--user-text)" : "var(--claude-text)",
          display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
          border: `1px solid ${isUser ? "var(--user-rail)" : "var(--claude-rail)"}30`
        }}>
          <Icon name={isUser ? "user" : "bot"} size={13}/>
        </div>
        <span style={{ fontSize:13, fontWeight:600, color: isUser ? "var(--user-text)" : "var(--claude-text)" }}>
          {isUser ? "You" : "Claude"}
        </span>
        {!isUser && <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)", background:"var(--surface-2)", padding:"1px 6px", borderRadius:4 }}>{m.model}</span>}
        <span style={{ flex:1 }}/>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)" }}>{m.at}</span>
      </div>

      {/* User content */}
      {isUser && <V1UserContent m={m}/>}

      {/* Assistant content */}
      {!isUser && (
        <div style={{ paddingLeft: 34 }}>
          {m.parts.map((p, i) => {
            const key = `${m.id}-${i}`;
            if (p.type === "text")  return <V1Prose key={key} text={p.text}/>;
            if (p.type === "think") return <V1Think key={key} text={p.text} mode={mode}/>;
            if (p.type === "diff")  return <div key={key} style={{ margin:"12px 0" }}><DiffBlock {...p}/></div>;
            if (p.type === "tool") {
              const open = mode === "compact" ? false : openTool[key] ?? false;
              return <V1Tool key={key} part={p} open={open} onToggle={() => setOpenTool(t => ({ ...t, [key]: !t[key] }))}/>;
            }
            return null;
          })}
        </div>
      )}
    </article>
  );
}

function V1UserContent({ m }) {
  if (m.kind === "command") {
    return (
      <div style={{ paddingLeft:34, display:"flex", alignItems:"flex-start", gap:10 }}>
        <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px",
                       borderRadius:"var(--r-pill)", background:"var(--accent-soft)", color:"var(--accent-text)",
                       fontFamily:"var(--font-mono)", fontSize:12, fontWeight:500, flexShrink:0 }}>
          <Icon name="command" size={11}/> {m.name}
        </span>
        {m.args && <span style={{ fontSize:14, color:"var(--text-2)", lineHeight:1.55, paddingTop:2 }}>{m.args}</span>}
      </div>
    );
  }
  if (m.kind === "stderr") {
    return (
      <div style={{ marginLeft:34, padding:"10px 14px", borderRadius:8, background:"var(--danger-soft)", color:"var(--danger)",
                    fontFamily:"var(--font-mono)", fontSize:12, whiteSpace:"pre-wrap", border:"1px solid var(--danger)20" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, fontFamily:"var(--font-sans)", fontSize:11.5, fontWeight:500, textTransform:"uppercase", letterSpacing:".06em" }}>
          <Icon name="warn" size={12}/> stderr from prior tool
        </div>
        {m.text}
      </div>
    );
  }
  return <p style={{ marginLeft:34, margin:"0 0 0 34px", fontSize:15, lineHeight:1.6, color:"var(--text)" }}>{m.text}</p>;
}

function V1Prose({ text }) {
  return (
    <p style={{ margin:"10px 0", fontSize:14.5, lineHeight:1.65, color:"var(--text)" }}>
      <RichText text={text}/>
    </p>
  );
}

function V1Think({ text, mode }) {
  if (mode === "compact") return null;
  return (
    <div style={{ display:"flex", gap:10, padding:"10px 0", borderLeft:"2px solid var(--border-strong)", paddingLeft:14, margin:"6px 0" }}>
      <div style={{ flex:1, color:"var(--think-text)", fontSize:13.5, fontStyle:"italic", lineHeight:1.6 }}>
        <span style={{ fontStyle:"normal", fontWeight:500, color:"var(--text-3)", marginRight:8, fontSize:11.5, textTransform:"uppercase", letterSpacing:".06em" }}>Thinking</span>
        {text}
      </div>
    </div>
  );
}

function V1Tool({ part, open, onToggle }) {
  return (
    <div style={{ margin:"10px 0", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden", background:"var(--surface)" }}>
      <button onClick={onToggle} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
              background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
        <Icon name="chevron-right" size={12} style={{ color:"var(--text-3)", transform: open ? "rotate(90deg)" : "none", transition:"transform .15s" }}/>
        <div style={{ width:20, height:20, borderRadius:5, background:"var(--tool-tint)", color:"var(--tool-text)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Icon name="tool" size={11}/>
        </div>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:12.5, fontWeight:500, color:"var(--text)" }}>{part.tool}</span>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11.5, color:"var(--text-3)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {part.args.command ?? part.args.file_path ?? part.args.description ?? ""}
        </span>
        {part.async && (
          <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10.5, color:"var(--info)", background:"var(--info-soft)", padding:"1px 7px", borderRadius:4 }}>
            <Icon name="spinner" size={10}/> background
          </span>
        )}
        {part.tokens && <span style={{ fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)" }}>{part.tokens}t</span>}
      </button>
      {open && (
        <div style={{ borderTop:"1px solid var(--border)", padding:12, background:"var(--surface-inset)" }}>
          {part.args.command && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Command</div>
              <CodeBlock language="bash" code={part.args.command} lineNumbers={false} dense/>
              {part.args.description && (
                <div style={{ marginTop:6, fontSize:12, color:"var(--text-3)", fontStyle:"italic" }}># {part.args.description}</div>
              )}
            </div>
          )}
          {part.args.file_path && (
            <div style={{ marginBottom:10, display:"flex", alignItems:"center", gap:6, fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-2)" }}>
              <Icon name="folder" size={12}/> {part.args.file_path}
              {part.args.offset != null && <span style={{ color:"var(--text-3)" }}>:{part.args.offset}–{part.args.offset+(part.args.limit||0)}</span>}
            </div>
          )}
          {part.result && (
            <div>
              <div style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Result</div>
              <CodeBlock code={part.result} lineNumbers={false} dense/>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function V1TokenReport({ onClose }) {
  return (
    <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(20,15,10,.45)", backdropFilter:"blur(4px)",
                                    display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:760, maxHeight:"86%", background:"var(--surface)", borderRadius:14, boxShadow:"var(--shadow-lg)",
        border:"1px solid var(--border)", overflow:"hidden", display:"flex", flexDirection:"column"
      }}>
        <header style={{ padding:"20px 24px 16px", borderBottom:"1px solid var(--border)" }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
            <div>
              <h2 style={{ margin:0, fontFamily:"var(--font-serif)", fontWeight:500, fontSize:22, letterSpacing:"-.01em" }}>Token consumption</h2>
              <p style={{ margin:"4px 0 0", color:"var(--text-3)", fontSize:13, lineHeight:1.5 }}>
                Grouped by agent and model. Units are model-relative weights — stable across price changes.
              </p>
            </div>
            <button onClick={onClose} style={{ background:"transparent", border:"none", padding:6, borderRadius:6, cursor:"pointer", color:"var(--text-3)" }}>
              <Icon name="close" size={16}/>
            </button>
          </div>
        </header>

        <div className="scroll" style={{ padding:24, overflowY:"auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12, marginBottom:24 }}>
            {[
              { label:"Duration", value:TOKEN_REPORT.duration, sub:"first → last turn" },
              { label:"Tool calls", value:TOKEN_REPORT.toolCalls.total, sub:`main ${TOKEN_REPORT.toolCalls.main} · sub ${TOKEN_REPORT.toolCalls.sub}` },
              { label:"Cache hit", value:TOKEN_REPORT.cacheHit, sub:"read / (read + create + input)", tone:"success" },
              { label:"Total units", value:TOKEN_REPORT.totalUnits, sub:"weighted, all agents", tone:"accent" },
            ].map(s => (
              <div key={s.label} style={{ padding:"14px 16px", border:"1px solid var(--border)", borderRadius:10, background:"var(--surface-inset)" }}>
                <div style={{ fontSize:11, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500 }}>{s.label}</div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:24, fontWeight:500, marginTop:6,
                             color: s.tone==="success" ? "var(--success)" : s.tone==="accent" ? "var(--accent-text)" : "var(--text)" }}>{s.value}</div>
                <div style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"var(--font-mono)", fontSize:12 }}>
              <thead>
                <tr style={{ background:"var(--surface-2)", color:"var(--text-3)" }}>
                  {["Agent","Model","Input","Cache 5m","Cache 1h","Cache read","Output","Hit","Units"].map(h =>
                    <th key={h} style={{ padding:"9px 12px", textAlign:h==="Agent"||h==="Model"?"left":"right", fontWeight:500, fontSize:10.5, textTransform:"uppercase", letterSpacing:".06em" }}>{h}</th>)}
                </tr>
                <tr style={{ background:"var(--surface-2)", color:"var(--text-4)" }}>
                  {[" "," ","1.0×","1.25×","2.0×","0.1×"," "," "," "].map((w,i) =>
                    <th key={i} style={{ padding:"0 12px 7px", textAlign:i<2?"left":"right", fontWeight:400, fontSize:10 }}>{w}</th>)}
                </tr>
              </thead>
              <tbody>
                {TOKEN_REPORT.rows.map((r,i) => (
                  <tr key={i} style={{ borderTop:"1px solid var(--border)" }}>
                    <td style={{ padding:"10px 12px", fontFamily:"var(--font-sans)", fontWeight:500 }}>{r.agent}</td>
                    <td style={{ padding:"10px 12px", color:"var(--text-2)" }}>{r.model} <span style={{ color:"var(--text-4)" }}>· {r.calls}</span></td>
                    {[r.input, r.c5, r.c1h, r.cRd, r.out].map((c,j) => (
                      <td key={j} style={{ padding:"10px 12px", textAlign:"right" }}>
                        <div>{c.raw}</div>
                        <div style={{ color:"var(--text-3)", fontSize:11 }}>{c.weight}</div>
                      </td>
                    ))}
                    <td style={{ padding:"10px 12px", textAlign:"right", color:"var(--success)" }}>{r.hit}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", color:"var(--accent-text)", fontWeight:500 }}>{r.units}</td>
                  </tr>
                ))}
                <tr style={{ borderTop:"1px solid var(--border)", background:"var(--surface-inset)" }}>
                  <td colSpan={2} style={{ padding:"10px 12px", fontFamily:"var(--font-sans)", fontSize:11.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em" }}>Total units</td>
                  <td style={{ padding:"10px 12px", textAlign:"right" }}>{TOKEN_REPORT.totals.input}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right" }}>{TOKEN_REPORT.totals.c5}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right" }}>{TOKEN_REPORT.totals.c1h}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right" }}>{TOKEN_REPORT.totals.cRd}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right" }}>{TOKEN_REPORT.totals.out}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right", color:"var(--success)" }}>{TOKEN_REPORT.totals.hit}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right", color:"var(--accent-text)", fontWeight:500 }}>{TOKEN_REPORT.totals.units}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <footer style={{ padding:"14px 24px", borderTop:"1px solid var(--border)", display:"flex", justifyContent:"flex-end", gap:8 }}>
          <button style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px",
                       border:"1px solid var(--border)", borderRadius:8, background:"var(--surface)",
                       cursor:"pointer", color:"var(--text-2)", fontSize:12.5, fontFamily:"inherit" }}>
            <Icon name="download" size={12}/> Export CSV
          </button>
        </footer>
      </div>
    </div>
  );
}

Object.assign(window, { V1Reading });
