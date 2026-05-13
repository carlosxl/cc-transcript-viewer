// Variation 2 — "Workspace"
// A three-pane developer-tool feel: project tree (left) → transcript
// (center) → contextual inspector (right). Tool calls are collapsed in
// the transcript and "open" in the right inspector — same metaphor as
// VSCode debug, Chrome devtools, Linear issue panel.

function V2Workspace({ theme, onTheme }) {
  const [selectedTool, setSelectedTool] = React.useState({ msgId:"m8", partIdx:1 });
  const [openProject, setOpenProject] = React.useState({ "cc-transcript-viewer": true, "sandbox": false, "langfuse": false });
  const [mode, setMode] = React.useState("details");
  const [tab, setTab] = React.useState("inspector"); // inspector | tokens | files

  const sessionsByProject = React.useMemo(() => {
    const g = {}; SESSIONS.forEach(s => (g[s.project] ||= []).push(s)); return g;
  }, []);

  const selected = MESSAGES.find(m => m.id === selectedTool.msgId)?.parts?.[selectedTool.partIdx];

  return (
    <div className="cc-mock" data-theme={theme} style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--bg)" }}>
      {/* ─────────── Top bar ─────────── */}
      <div style={{ display:"flex", alignItems:"center", height:44, borderBottom:"1px solid var(--border)", background:"var(--surface)", padding:"0 12px", gap:12, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:22, height:22, borderRadius:6, background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" }}>
            <Icon name="terminal" size={13} stroke={2}/>
          </div>
          <span style={{ fontWeight:600, fontSize:13, letterSpacing:"-.01em" }}>Transcript</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color:"var(--text-3)" }}>
          <Icon name="chevron-right" size={11}/>
          <Icon name="folder" size={11}/>
          <span style={{ fontFamily:"var(--font-mono)" }}>{ACTIVE.project}</span>
          <Icon name="chevron-right" size={11}/>
          <span style={{ color:"var(--text)", maxWidth:380, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ACTIVE.shortTitle}</span>
        </div>
        <div style={{ flex:1 }}/>
        {/* Inline metrics bar */}
        <div style={{ display:"flex", alignItems:"center", gap:14, fontFamily:"var(--font-mono)", fontSize:11.5, color:"var(--text-2)" }}>
          <span><span style={{ color:"var(--text-3)" }}>in</span> {ACTIVE.metrics.in}</span>
          <span><span style={{ color:"var(--text-3)" }}>out</span> {ACTIVE.metrics.out}</span>
          <span><span style={{ color:"var(--text-3)" }}>c+</span> {ACTIVE.metrics.cachePlus}</span>
          <span><span style={{ color:"var(--text-3)" }}>c−</span> {ACTIVE.metrics.cacheMinus}</span>
          <span style={{ color:"var(--success)" }}>● hit {ACTIVE.metrics.hit}</span>
        </div>
        <div style={{ width:1, height:18, background:"var(--border)" }}/>
        <div style={{ display:"flex", alignItems:"center", gap:2, padding:2, background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:7 }}>
          {["compact","details"].map(m =>
            <button key={m} onClick={() => setMode(m)}
              style={{ padding:"3px 10px", borderRadius:5, border:"none", cursor:"pointer",
                      background: mode===m ? "var(--surface)" : "transparent", color: mode===m ? "var(--text)" : "var(--text-3)",
                      fontSize:11, fontFamily:"inherit", fontWeight: mode===m ? 500 : 400 }}>
              {m.charAt(0).toUpperCase()+m.slice(1)}
            </button>)}
        </div>
        <ThemeToggle theme={theme} onChange={onTheme} compact/>
      </div>

      <div style={{ flex:1, display:"flex", minHeight:0 }}>
        {/* ─────────── Left: project tree ─────────── */}
        <aside style={{ width:260, flex:"0 0 260px", borderRight:"1px solid var(--border)", background:"var(--surface-inset)", display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"10px 12px 8px", display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500, flex:1 }}>Sessions</span>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)" }}>{SESSIONS.length}</span>
            <button style={{ background:"transparent", border:"none", padding:3, borderRadius:4, cursor:"pointer", color:"var(--text-3)" }}>
              <Icon name="filter" size={12}/>
            </button>
          </div>
          <div style={{ padding:"0 8px 8px" }}>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", color:"var(--text-3)" }}>
                <Icon name="search" size={12}/>
              </span>
              <input placeholder="Filter" style={{ width:"100%", padding:"5px 8px 5px 26px", border:"1px solid var(--border)", borderRadius:6,
                      background:"var(--surface)", color:"var(--text)", fontSize:12, fontFamily:"inherit", outline:"none" }}/>
            </div>
          </div>
          <div className="scroll" style={{ flex:1, overflowY:"auto", padding:"0 4px 12px" }}>
            {Object.entries(sessionsByProject).map(([proj, list]) => (
              <div key={proj}>
                <button onClick={() => setOpenProject(p => ({ ...p, [proj]: !p[proj] }))}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:6, padding:"5px 8px", border:"none", background:"transparent", cursor:"pointer", fontFamily:"inherit", color:"var(--text-2)" }}>
                  <Icon name="chevron-right" size={11} style={{ color:"var(--text-3)", transform: openProject[proj] ? "rotate(90deg)" : "none", transition:"transform .15s" }}/>
                  <Icon name="folder" size={12} style={{ color:"var(--text-3)" }}/>
                  <span style={{ fontSize:12, flex:1, textAlign:"left" }}>{proj}</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)" }}>{list.length}</span>
                </button>
                {openProject[proj] && list.map(s => (
                  <div key={s.id} style={{
                    padding:"5px 10px 5px 28px", marginRight:4, marginBottom:1, borderRadius:5, cursor:"pointer",
                    background: s.active ? "var(--accent-soft)" : "transparent",
                    position:"relative"
                  }}>
                    {s.active && <div style={{ position:"absolute", left:0, top:2, bottom:2, width:3, borderRadius:2, background:"var(--accent)" }}/>}
                    <div style={{
                      fontSize:12, lineHeight:1.4, color: s.active ? "var(--accent-text)" : "var(--text-2)",
                      fontWeight: s.active ? 500 : 400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
                    }}>{s.title}</div>
                    <div style={{ display:"flex", gap:8, fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)" }}>
                      <span>{s.msgs}msg</span><span>{s.cost}</span><span style={{ marginLeft:"auto" }}>{s.ago.replace(" ago","")}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </aside>

        {/* ─────────── Center: transcript ─────────── */}
        <main style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", background:"var(--bg)" }}>
          <div style={{ padding:"14px 24px 10px", borderBottom:"1px solid var(--border)" }}>
            <h1 style={{ margin:0, fontSize:16, fontWeight:600, color:"var(--text)", lineHeight:1.4,
                         display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{ACTIVE.title}</h1>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:6, color:"var(--text-3)", fontSize:11.5, fontFamily:"var(--font-mono)" }}>
              <span>{ACTIVE.path}</span>
              <span>·</span><span>{ACTIVE.started}</span>
              <span>·</span><span>{ACTIVE.duration}</span>
              <span>·</span><span>{ACTIVE.model}</span>
              <span>·</span><span>{ACTIVE.metrics.toolCalls} tool calls</span>
            </div>
          </div>
          <div className="scroll" style={{ flex:1, overflowY:"auto", padding:"16px 24px 60px" }}>
            {MESSAGES.map(m => <V2Turn key={m.id} m={m} mode={mode} selected={selectedTool} onSelectTool={setSelectedTool}/>)}
          </div>
        </main>

        {/* ─────────── Right: inspector ─────────── */}
        <aside style={{ width:420, flex:"0 0 420px", borderLeft:"1px solid var(--border)", background:"var(--surface)", display:"flex", flexDirection:"column" }}>
          <div style={{ display:"flex", borderBottom:"1px solid var(--border)" }}>
            {[
              { id:"inspector", label:"Inspector", icon:"info" },
              { id:"tokens", label:"Tokens", icon:"chart" },
              { id:"files", label:"Files", icon:"folder" },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flex:1, display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, padding:"11px 10px",
                        border:"none", borderBottom: tab===t.id ? "2px solid var(--accent)" : "2px solid transparent",
                        background:"transparent", color: tab===t.id ? "var(--text)" : "var(--text-3)",
                        fontSize:12, fontWeight: tab===t.id ? 500 : 400, cursor:"pointer", fontFamily:"inherit",
                        marginBottom:-1 }}>
                <Icon name={t.icon} size={12}/> {t.label}
              </button>
            ))}
          </div>
          <div className="scroll" style={{ flex:1, overflowY:"auto" }}>
            {tab === "inspector" && <V2Inspector part={selected}/>}
            {tab === "tokens" && <V2TokensPanel/>}
            {tab === "files" && <V2FilesPanel/>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function V2Turn({ m, mode, selected, onSelectTool }) {
  const isUser = m.role === "user";
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:6 }}>
        <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11.5, fontWeight:600,
                       color: isUser ? "var(--user-text)" : "var(--claude-text)" }}>
          <Icon name={isUser ? "user" : "bot"} size={11}/> {isUser ? "User" : "Claude"}
        </span>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)" }}>{m.at}</span>
        {!isUser && <span style={{ fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)", background:"var(--surface-2)", padding:"0 5px", borderRadius:3 }}>{m.model}</span>}
      </div>
      <div style={{
        borderLeft: `2px solid ${isUser ? "var(--user-rail)" : "var(--claude-rail)"}`,
        paddingLeft:14, marginLeft:4
      }}>
        {isUser && m.kind === "command" && (
          <div style={{ display:"flex", alignItems:"center", gap:8, fontFamily:"var(--font-mono)", fontSize:12.5 }}>
            <span style={{ color:"var(--accent-text)", fontWeight:500 }}>{m.name}</span>
            {m.args && <span style={{ color:"var(--text-2)" }}>{m.args}</span>}
          </div>
        )}
        {isUser && m.kind === "stderr" && (
          <div style={{ padding:"6px 10px", borderRadius:5, background:"var(--danger-soft)", border:"1px solid var(--danger)20",
                        fontFamily:"var(--font-mono)", fontSize:11.5, color:"var(--danger)", whiteSpace:"pre-wrap" }}>{m.text}</div>
        )}
        {isUser && m.kind === "text" && (
          <div style={{ fontSize:13.5, lineHeight:1.6, color:"var(--text)" }}>{m.text}</div>
        )}
        {!isUser && m.parts.map((p, i) => {
          if (p.type === "text")  return <div key={i} style={{ fontSize:13.5, lineHeight:1.6, color:"var(--text)", margin:"4px 0" }}><RichText text={p.text}/></div>;
          if (p.type === "think" && mode !== "compact") return (
            <div key={i} style={{ fontSize:12.5, color:"var(--think-text)", fontStyle:"italic", lineHeight:1.55, margin:"4px 0", display:"flex", gap:8 }}>
              <Icon name="spark" size={11} style={{ color:"var(--text-3)", marginTop:3, flexShrink:0, fontStyle:"normal" }}/>
              {p.text}
            </div>
          );
          if (p.type === "diff")  return <div key={i} style={{ margin:"8px 0" }}><DiffBlock {...p}/></div>;
          if (p.type === "tool") {
            const isSel = selected.msgId === m.id && selected.partIdx === i;
            return (
              <button key={i} onClick={() => onSelectTool({ msgId:m.id, partIdx:i })}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 10px", borderRadius:6,
                         background: isSel ? "var(--accent-soft)" : "var(--surface-2)",
                         border: `1px solid ${isSel ? "var(--accent)" : "var(--border)"}`,
                         margin:"4px 0", cursor:"pointer", fontFamily:"inherit", width:"100%", textAlign:"left",
                         color: isSel ? "var(--accent-text)" : "var(--text)" }}>
                <Icon name="tool" size={11} style={{ color: isSel ? "var(--accent)" : "var(--text-3)" }}/>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:12, fontWeight:500 }}>{p.tool}</span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:11.5, color: isSel ? "var(--accent-text)" : "var(--text-3)",
                              flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {p.args.command ?? p.args.file_path ?? p.args.description}
                </span>
                {p.async && <Icon name="spinner" size={10} style={{ color:"var(--info)" }}/>}
                <Icon name="chevron-right" size={11} style={{ color: isSel ? "var(--accent)" : "var(--text-4)" }}/>
              </button>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

function V2Inspector({ part }) {
  if (!part || part.type !== "tool") {
    return (
      <div style={{ padding:32, textAlign:"center", color:"var(--text-3)" }}>
        <div style={{ width:36, height:36, borderRadius:10, background:"var(--surface-2)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px" }}>
          <Icon name="info" size={16}/>
        </div>
        <div style={{ fontSize:13, color:"var(--text-2)" }}>Select a tool call</div>
        <div style={{ fontSize:12, marginTop:4 }}>Click any tool capsule in the transcript to inspect its arguments and output.</div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:26, height:26, borderRadius:7, background:"var(--accent-soft)", color:"var(--accent-text)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Icon name="tool" size={13}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:500 }}>{part.tool}</div>
            <div style={{ fontSize:11, color:"var(--text-3)" }}>tool call · {part.tokens ?? 0} tokens</div>
          </div>
          {part.async && (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 7px", borderRadius:4, background:"var(--info-soft)", color:"var(--info)", fontSize:10.5 }}>
              <Icon name="spinner" size={10}/> background
            </span>
          )}
        </div>
        {part.args.description && (
          <div style={{ marginTop:8, fontSize:12, color:"var(--text-2)", lineHeight:1.5 }}>{part.args.description}</div>
        )}
      </div>

      <div style={{ padding:16 }}>
        <div style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500, marginBottom:6 }}>Arguments</div>
        {part.args.command && <CodeBlock language="bash" code={part.args.command} lineNumbers={false} dense/>}
        {part.args.file_path && (
          <div style={{ padding:"8px 12px", border:"1px solid var(--code-border)", borderRadius:8, background:"var(--code-bg)", fontFamily:"var(--font-mono)", fontSize:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, color:"var(--text-2)" }}>
              <Icon name="folder" size={12} style={{ color:"var(--text-3)" }}/>{part.args.file_path}
            </div>
            {part.args.offset != null && (
              <div style={{ color:"var(--text-3)", fontSize:11, marginTop:4 }}>offset {part.args.offset} · limit {part.args.limit}</div>
            )}
          </div>
        )}

        <div style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500, margin:"14px 0 6px", display:"flex", alignItems:"center", gap:6 }}>
          <span>Result</span>
          <span style={{ flex:1 }}/>
          <button style={{ background:"transparent", border:"none", padding:0, color:"var(--text-3)", cursor:"pointer", fontSize:11, fontFamily:"inherit", textTransform:"none", letterSpacing:0, display:"inline-flex", alignItems:"center", gap:3 }}>
            <Icon name="copy" size={10}/> Copy
          </button>
        </div>
        <CodeBlock code={part.result} lineNumbers={false} dense/>
      </div>
    </div>
  );
}

function V2TokensPanel() {
  return (
    <div style={{ padding:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
        {[
          { label:"Total units", value:TOKEN_REPORT.totalUnits, tone:"accent" },
          { label:"Cache hit", value:TOKEN_REPORT.cacheHit, tone:"success" },
          { label:"Duration", value:TOKEN_REPORT.duration },
          { label:"Tool calls", value:TOKEN_REPORT.toolCalls.total },
        ].map(s => (
          <div key={s.label} style={{ padding:"10px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-inset)" }}>
            <div style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500 }}>{s.label}</div>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:500, marginTop:4,
                         color: s.tone==="accent" ? "var(--accent-text)" : s.tone==="success" ? "var(--success)" : "var(--text)" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500, marginBottom:6 }}>Usage breakdown</div>
      {[
        { label:"Input", value:90, raw:"1.4ku", color:"var(--info)" },
        { label:"Output", value:14600, raw:"1.5mu", color:"var(--claude-rail)" },
        { label:"Cache 1h", value:207300, raw:"6.2mu", color:"var(--warn)" },
        { label:"Cache rd", value:4600000, raw:"7.4mu", color:"var(--success)" },
      ].map(r => {
        const maxRaw = 7.4; // mu scale
        const muNum = parseFloat(r.raw);
        const pct = (muNum / maxRaw) * 100;
        return (
          <div key={r.label} style={{ marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"var(--font-mono)", fontSize:11.5, marginBottom:3 }}>
              <span style={{ color:"var(--text-2)" }}>{r.label}</span>
              <span style={{ color:"var(--text-3)" }}>{r.raw}</span>
            </div>
            <div style={{ height:6, background:"var(--surface-2)", borderRadius:3, overflow:"hidden" }}>
              <div style={{ width:`${pct}%`, height:"100%", background:r.color }}/>
            </div>
          </div>
        );
      })}

      <button style={{ marginTop:12, width:"100%", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, padding:"8px 12px",
                       border:"1px solid var(--border)", borderRadius:7, background:"var(--surface-2)", color:"var(--text-2)",
                       cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>
        <Icon name="chart" size={12}/> Full report
      </button>
    </div>
  );
}

function V2FilesPanel() {
  const files = [
    { name:"src/static.ts", reads:2, writes:1, line:"118–125" },
    { name:"~/.claude/skills/security-review/SKILL.md", reads:1, writes:0 },
    { name:"~/.claude/commands/", reads:1, writes:0 },
  ];
  return (
    <div style={{ padding:16 }}>
      <div style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500, marginBottom:8 }}>
        Files touched in this session
      </div>
      {files.map(f => (
        <div key={f.name} style={{ padding:"9px 10px", border:"1px solid var(--border)", borderRadius:7, marginBottom:6, background:"var(--surface-inset)", display:"flex", alignItems:"center", gap:8 }}>
          <Icon name="folder" size={12} style={{ color:"var(--text-3)" }}/>
          <span style={{ flex:1, fontFamily:"var(--font-mono)", fontSize:11.5, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)" }}>
            <span style={{ color:"var(--info)" }}>{f.reads}r</span> <span style={{ color:"var(--accent)" }}>{f.writes}w</span>
          </span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { V2Workspace });
