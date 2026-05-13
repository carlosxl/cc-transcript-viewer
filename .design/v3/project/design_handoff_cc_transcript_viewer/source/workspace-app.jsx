// Main Workspace shell — full-bleed three-pane prototype.
// Left: project/session tree.  Center: transcript with rich rendering.
// Right: tool inspector v2.  Keyboard-navigable.  Resizable panes.

const ROLE_STYLES = {
  user:      { rail:"var(--user-rail)",   tint:"var(--user-tint)",   label:"You",     icon:"user"  },
  assistant: { rail:"var(--claude-rail)", tint:"var(--claude-tint)", label:"Claude",  icon:"spark" },
};

// ── Resizable handle ────────────────────────────────────────────────
function ResizeHandle({ onDrag, vertical }) {
  const onDown = (e) => {
    e.preventDefault();
    const start = vertical ? e.clientY : e.clientX;
    const move = (ev) => onDrag((vertical ? ev.clientY : ev.clientX) - start);
    const up   = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); document.body.style.cursor = ""; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    document.body.style.cursor = vertical ? "row-resize" : "col-resize";
  };
  return <div onMouseDown={onDown} style={{
    width: vertical ? "100%" : 5, height: vertical ? 5 : "100%",
    cursor: vertical ? "row-resize" : "col-resize", flex:"0 0 auto",
    background:"transparent", position:"relative", zIndex:5
  }}>
    <div style={{ position:"absolute", inset:0, margin: vertical ? "2px 0" : "0 2px", background:"var(--border)", opacity:.5 }}/>
  </div>;
}

// ── Sidebar: project tree + sessions ───────────────────────────────
function Sidebar({ sessions, activeId, onPick, onOpenSearch }) {
  const projects = {};
  sessions.forEach(s => { (projects[s.project] ??= []).push(s); });
  const [collapsed, setCollapsed] = React.useState({});
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--surface-2)", borderRight:"1px solid var(--border)" }}>
      <div style={{ padding:"12px 14px 10px", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <div style={{ width:22, height:22, borderRadius:6, background:"var(--accent)", color:"#fff",
                         display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:12 }}>C</div>
          <div style={{ fontWeight:600, fontSize:13.5, color:"var(--text)" }}>Transcripts</div>
          <span style={{ flex:1 }}/>
          <button className="cc-icon-btn"><Icon name="more" size={12}/></button>
        </div>
        <button onClick={onOpenSearch} style={{
          width:"100%", display:"flex", alignItems:"center", gap:8, padding:"6px 10px",
          background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-1)",
          color:"var(--text-3)", fontFamily:"inherit", fontSize:12, cursor:"pointer", textAlign:"left"
        }}>
          <Icon name="search" size={12}/>
          <span style={{ flex:1 }}>Search sessions, tools, files…</span>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:10, border:"1px solid var(--border)", padding:"1px 5px", borderRadius:4, background:"var(--surface-2)" }}>⌘K</span>
        </button>
      </div>
      <div className="scroll" style={{ flex:1, overflow:"auto", padding:"6px 0" }}>
        {Object.entries(projects).map(([proj, list]) => {
          const isCollapsed = collapsed[proj];
          return (
            <div key={proj} style={{ padding:"4px 0" }}>
              <button onClick={() => setCollapsed(c => ({...c, [proj]: !c[proj]}))}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 14px", width:"100%", background:"transparent",
                         border:"none", cursor:"pointer", color:"var(--text-3)", textTransform:"uppercase",
                         letterSpacing:".06em", fontSize:10.5, fontWeight:600, fontFamily:"inherit" }}>
                <Icon name={isCollapsed ? "chevron-right" : "chevron-down"} size={9}/>
                <Icon name="folder" size={11}/>
                <span>{proj}</span>
                <span style={{ flex:1 }}/>
                <span style={{ color:"var(--text-4)" }}>{list.length}</span>
              </button>
              {!isCollapsed && list.map(s => (
                <button key={s.id} onClick={()=>onPick(s.id)}
                  style={{ display:"block", width:"100%", textAlign:"left", padding:"6px 14px 7px 28px", border:"none",
                           background: s.id === activeId ? "var(--accent-soft)" : "transparent",
                           borderLeft: s.id === activeId ? "2px solid var(--accent)" : "2px solid transparent",
                           cursor:"pointer", fontFamily:"inherit" }}>
                  <div style={{ fontSize:12.5, color: s.id === activeId ? "var(--text)" : "var(--text-2)",
                                fontWeight: s.id === activeId ? 500 : 400,
                                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {s.pinned && <Icon name="star" size={10} style={{ marginRight:4, color:"var(--accent)" }}/>}
                    {s.title}
                  </div>
                  <div style={{ display:"flex", gap:8, marginTop:3, fontSize:10.5, color:"var(--text-3)", fontFamily:"var(--font-mono)" }}>
                    <span>{s.ago}</span>
                    <span>·</span>
                    <span>{s.msgs} msg</span>
                    <span>·</span>
                    <span>{s.cost}</span>
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Transcript message renderer ────────────────────────────────────
function ToolCapsule({ part, partId, active, onClick }) {
  const tint = part.status === "fail" ? "var(--danger-soft)"
            : part.status === "running" ? "var(--warn-soft)"
            : "var(--surface-2)";
  const dot  = part.status === "fail" ? "var(--danger)"
            : part.status === "running" ? "var(--warn)"
            : "var(--success)";
  return (
    <button data-tool-anchor={partId} onClick={onClick}
      style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"8px 12px",
               background:tint, border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
               borderRadius:"var(--r-2)", cursor:"pointer", color:"var(--text-2)", fontFamily:"inherit",
               textAlign:"left", outline: active ? "2px solid var(--accent-soft)" : "none", outlineOffset:-1 }}>
      <Icon name={part.tool === "Bash" ? "terminal" : part.tool === "Read" ? "code" : "tool"} size={14}/>
      <span style={{ fontFamily:"var(--font-mono)", fontSize:12, fontWeight:600, color:"var(--text)" }}>{part.tool}</span>
      <span style={{ fontFamily:"var(--font-mono)", fontSize:11.5, color:"var(--text-3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, minWidth:0 }}>
        {part.tool === "Bash" ? part.args.command : part.args?.file_path || part.args?.description || ""}
      </span>
      {part.duration && <span style={{ fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)" }}>{part.duration}</span>}
      <Icon name="circle" size={8} style={{ color: dot }}/>
      <Icon name="chevron-right" size={12} style={{ color:"var(--text-3)" }}/>
    </button>
  );
}

function MessagePart({ part, partId, msgId, activePart, onPickTool, onPickDiff, activeDiff }) {
  if (part.type === "text") return <div style={{ fontSize:14, lineHeight:1.65, color:"var(--text)" }}><RichText text={part.text}/></div>;
  if (part.type === "think") return (
    <div data-thinking style={{ padding:"10px 14px", background:"var(--think-tint)", border:"1px dashed var(--border-strong)",
                  borderRadius:"var(--r-2)", color:"var(--think-text)", fontSize:13, fontStyle:"italic", lineHeight:1.55 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, fontStyle:"normal", fontSize:10.5,
                    textTransform:"uppercase", letterSpacing:".08em", color:"var(--text-3)", fontWeight:600 }}>
        <Icon name="spark" size={10}/> Thinking
      </div>
      {part.text}
    </div>
  );
  if (part.type === "tool") return <ToolCapsule part={part} partId={partId} active={activePart === partId} onClick={() => onPickTool(part, partId)}/>;
  if (part.type === "diff") {
    const isActive = activeDiff === partId;
    return (
      <div data-tool-anchor={partId} onClick={() => onPickDiff(part, partId)}
        style={{ cursor:"pointer", outline: isActive ? "2px solid var(--accent-soft)" : "none", borderRadius:"var(--r-2)" }}>
        <DiffBlock {...part}/>
      </div>
    );
  }
  if (part.type === "markdown") return <Markdown text={part.text}/>;
  return null;
}

function UserMessage({ m }) {
  if (m.kind === "command") return (
    <div data-msg-anchor={m.id} style={{ padding:"10px 14px", background:"var(--surface-2)", border:"1px solid var(--border)",
                  borderRadius:"var(--r-2)", display:"flex", alignItems:"baseline", gap:8, fontFamily:"var(--font-mono)" }}>
      <Icon name="command" size={12} style={{ color:"var(--accent)" }}/>
      <span style={{ color:"var(--accent-text)", fontSize:12.5, fontWeight:600 }}>{m.name}</span>
      {m.args && <span style={{ color:"var(--text-2)", fontSize:12 }}>{m.args}</span>}
      <span style={{ flex:1 }}/>
      <span style={{ fontSize:10.5, color:"var(--text-3)" }}>{m.at}</span>
    </div>
  );
  if (m.kind === "stderr") return (
    <div data-msg-anchor={m.id} style={{ padding:"10px 14px", background:"var(--danger-soft)", border:"1px solid var(--danger)",
                  borderRadius:"var(--r-2)", color:"var(--danger)", fontFamily:"var(--font-mono)", fontSize:11.5, lineHeight:1.55, whiteSpace:"pre-wrap" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, fontFamily:"var(--font-sans)", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:".06em" }}>
        <Icon name="warn" size={11}/> stderr
        <span style={{ flex:1 }}/>
        <span style={{ color:"var(--text-3)", fontWeight:400 }}>{m.at}</span>
      </div>
      {m.text}
    </div>
  );
  return (
    <div data-msg-anchor={m.id} style={{ display:"flex", gap:12 }}>
      <div style={{ flex:"0 0 28px", width:28, height:28, borderRadius:"50%", background:"var(--user-tint)",
                     color:"var(--user-text)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <Icon name="user" size={14}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:5 }}>
          <span style={{ fontWeight:600, fontSize:13, color:"var(--text)" }}>You</span>
          <span style={{ fontSize:10.5, color:"var(--text-3)", fontFamily:"var(--font-mono)" }}>{m.at}</span>
        </div>
        <div style={{ fontSize:14, lineHeight:1.65, color:"var(--text)" }}><RichText text={m.text}/></div>
      </div>
    </div>
  );
}

function AssistantMessage({ m, activePart, activeDiff, onPickTool, onPickDiff }) {
  return (
    <div data-msg-anchor={m.id} style={{ display:"flex", gap:12 }}>
      <div style={{ flex:"0 0 28px", width:28, height:28, borderRadius:"50%", background:"var(--claude-tint)",
                     color:"var(--claude-text)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <Icon name="spark" size={14}/>
      </div>
      <div style={{ flex:1, minWidth:0, display:"grid", gap:10 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
          <span style={{ fontWeight:600, fontSize:13, color:"var(--text)" }}>Claude</span>
          <span style={{ fontSize:10.5, color:"var(--text-3)", fontFamily:"var(--font-mono)" }}>{m.model}</span>
          <span style={{ fontSize:10.5, color:"var(--text-3)", fontFamily:"var(--font-mono)" }}>· {m.at}</span>
        </div>
        {m.parts.map((p, i) => (
          <MessagePart key={i} part={p} partId={`${m.id}-${i}`} msgId={m.id}
            activePart={activePart} activeDiff={activeDiff}
            onPickTool={onPickTool} onPickDiff={onPickDiff}/>
        ))}
      </div>
    </div>
  );
}

// ── Main shell ─────────────────────────────────────────────────────
function Workspace({ tweaks, forceNarrow }) {
  const [rightOpen, setRightOpen] = React.useState(true);
  const [sessionId, setSessionId] = React.useState("s1");
  const [pinned, setPinned] = React.useState(() => {
    const init = {};
    WS_SESSIONS.forEach(s => { if (s.pinned) init[s.id] = true; });
    return init;
  });
  const togglePin = (id) => setPinned(p => ({ ...p, [id]: !p[id] }));
  const [query, setQuery] = React.useState("");
  const [activePartId, setActivePartId] = React.useState(null);
  const [activeDiffId, setActiveDiffId] = React.useState(null);
  const [activePart, setActivePart] = React.useState(null);
  const [activeDiff, setActiveDiff] = React.useState(null);
  const [leftW, setLeftW] = React.useState(280);
  const [rightW, setRightW] = React.useState(440);
  const [focusedMsg, setFocusedMsg] = React.useState(0);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [forceRailTab, setForceRailTab] = React.useState(null);
  const [narrow, setNarrow] = React.useState(window.innerWidth < 1100);
  const effectiveNarrow = forceNarrow || narrow;
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const transcriptRef = React.useRef(null);

  React.useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1100);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPickTool = (part, partId) => { setActivePart(part); setActivePartId(partId); setActiveDiff(null); setActiveDiffId(null); setForceRailTab("inspector"); if (effectiveNarrow) setSheetOpen(true); };
  const onPickDiff = (part, partId) => { setActiveDiff(part); setActiveDiffId(partId); setActivePart(null); setActivePartId(null); setForceRailTab("inspector"); if (effectiveNarrow) setSheetOpen(true); };
  const onCloseInspector = () => { setActivePart(null); setActivePartId(null); setActiveDiff(null); setActiveDiffId(null); };

  const jumpBack = () => {
    const id = activePartId || activeDiffId;
    if (!id || !transcriptRef.current) return;
    const el = transcriptRef.current.querySelector(`[data-tool-anchor="${id}"]`);
    if (el) {
      const top = el.getBoundingClientRect().top - transcriptRef.current.getBoundingClientRect().top + transcriptRef.current.scrollTop - 100;
      transcriptRef.current.scrollTo({ top, behavior:"smooth" });
      el.animate([{ outline:"3px solid var(--accent)" }, { outline:"3px solid transparent" }], { duration:1100 });
    }
  };

  // Keyboard nav
  React.useEffect(() => {
    const onKey = (e) => {
      const tgt = e.target;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) {
        if (e.key === "Escape") tgt.blur();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        document.querySelector('input[placeholder*="Search"]')?.focus();
      } else if (e.key === "j") {
        setFocusedMsg(i => Math.min(i + 1, WS_MESSAGES.length - 1));
      } else if (e.key === "k") {
        setFocusedMsg(i => Math.max(i - 1, 0));
      } else if (e.key === "t") {
        document.documentElement.setAttribute("data-theme",
          document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
      } else if (e.key === "Escape") {
        if (searchOpen) setSearchOpen(false);
        else if (sheetOpen) setSheetOpen(false);
        else onCloseInspector();
      } else if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault(); setSearchOpen(true);
      } else if (e.key === "Enter" && (activePartId || activeDiffId)) {
        // already inspected
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Scroll to focused message
  React.useEffect(() => {
    const msg = WS_MESSAGES[focusedMsg];
    if (!msg || !transcriptRef.current) return;
    const el = transcriptRef.current.querySelector(`[data-msg-anchor="${msg.id}"]`);
    if (el) {
      const top = el.getBoundingClientRect().top - transcriptRef.current.getBoundingClientRect().top + transcriptRef.current.scrollTop - 80;
      transcriptRef.current.scrollTo({ top, behavior:"smooth" });
    }
  }, [focusedMsg]);

  const active = WS_SESSIONS.find(s => s.id === sessionId) || WS_SESSIONS[0];

  return (
    <div className="cc-mock" style={{ display:"flex", height:"100vh", width:"100vw", overflow:"hidden", background:"var(--bg)" }}>
      {/* SIDEBAR */}
      {!effectiveNarrow && (
        <>
          <div style={{ width:leftW, flex:"0 0 auto" }}>
            <Sidebar sessions={WS_SESSIONS} activeId={sessionId} onPick={setSessionId} onOpenSearch={()=>setSearchOpen(true)} onTogglePin={togglePin} pinned={pinned}/>
          </div>
          <ResizeHandle onDrag={(d) => setLeftW(w => Math.max(220, Math.min(420, w + d)))}/>
        </>
      )}
      {effectiveNarrow && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(20,18,14,.42)", zIndex:900 }}>
          <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", left:0, top:0, bottom:0, width:"min(320px, 85vw)", boxShadow:"var(--shadow-lg)" }}>
            <Sidebar sessions={WS_SESSIONS} activeId={sessionId} onPick={(id)=>{ setSessionId(id); setSidebarOpen(false); }} onOpenSearch={()=>{ setSearchOpen(true); setSidebarOpen(false); }} onTogglePin={togglePin} pinned={pinned}/>
          </div>
        </div>
      )}

      {/* CENTER */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, background:"var(--bg)" }}>
        {/* Header */}
        <div style={{ padding:"12px 22px", borderBottom:"1px solid var(--border)", background:"var(--surface)",
                       display:"flex", alignItems:"center", gap:14 }}>
          {effectiveNarrow && (
            <button onClick={()=>setSidebarOpen(true)} className="cc-icon-btn" style={{ padding:6, marginRight:4 }}>
              <Icon name="menu" size={16}/>
            </button>
          )}
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontSize:11, color:"var(--text-3)", fontFamily:"var(--font-mono)", textTransform:"uppercase", letterSpacing:".06em" }}>
              <Icon name="folder" size={10} style={{ marginRight:5, verticalAlign:"-1px" }}/>
              {active.project} · {active.id}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ fontSize:15, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {active.title}
              </div>
              <button onClick={()=>togglePin(active.id)}
                title={pinned[active.id] ? "Unstar" : "Star session"}
                style={{ padding:4, border:"none", background:"transparent", cursor:"pointer",
                         color: pinned[active.id] ? "var(--accent)" : "var(--text-4)", borderRadius:4, display:"inline-flex" }}>
                <Icon name="star" size={14} stroke={pinned[active.id] ? 0 : 1.6} style={{ fill: pinned[active.id] ? "var(--accent)" : "none" }}/>
              </button>
            </div>
          </div>
          {!effectiveNarrow && <MetricChip label="Messages" value={active.msgs} mono dense/>}
          {!effectiveNarrow && <MetricChip label="Tokens" value={active.cost} mono dense tone="accent"/>}
          {!effectiveNarrow && <MetricChip label="Model" value={active.model} mono dense/>}
          <ThemeToggle theme={document.documentElement.getAttribute("data-theme") || "light"} onChange={(t) => document.documentElement.setAttribute("data-theme", t)} compact/>
          {!effectiveNarrow && (
            <button onClick={()=>setRightOpen(o => !o)} className="cc-icon-btn" title={rightOpen ? "Hide side panel" : "Show side panel"}
              style={{ padding:"6px 8px", border:"1px solid var(--border)" }}>
              <Icon name="side" size={13}/>
            </button>
          )}
        </div>

        {/* Transcript */}
        <div style={{ position:"relative", flex:1, minHeight:0 }}>
        <div ref={transcriptRef} className="scroll" style={{ height:"100%", overflow:"auto", padding:"24px 36px 80px 36px" }}>
          <div style={{ maxWidth:820, margin:"0 auto", display:"grid", gap:22 }}>
            {WS_MESSAGES.map((m, idx) => (
              <div key={m.id} style={{ outline: idx === focusedMsg ? "1px solid var(--accent-soft)" : "none",
                                       outlineOffset:8, borderRadius:"var(--r-2)", transition:"outline-color 120ms" }}>
                {m.role === "user"
                  ? <UserMessage m={m}/>
                  : <AssistantMessage m={m}
                      activePart={activePartId} activeDiff={activeDiffId}
                      onPickTool={onPickTool} onPickDiff={onPickDiff}/>}
              </div>
            ))}
          </div>
        </div>
        </div>

        {/* Status bar / keyboard hint */}
        <div style={{ display:"flex", alignItems:"center", gap:14, padding:"6px 22px", borderTop:"1px solid var(--border)",
                       background:"var(--surface-2)", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)" }}>
          <span><kbd style={kbdStyle}>j</kbd>/<kbd style={kbdStyle}>k</kbd> message</span>
          <span><kbd style={kbdStyle}>/</kbd> or <kbd style={kbdStyle}>⌘K</kbd> search</span>
          <span><kbd style={kbdStyle}>t</kbd> theme</span>
          <span><kbd style={kbdStyle}>Esc</kbd> close</span>
          <span style={{ flex:1 }}/>
          <span>msg {focusedMsg + 1} / {WS_MESSAGES.length}</span>
        </div>
      </div>

      {!effectiveNarrow && rightOpen && <ResizeHandle onDrag={(d) => setRightW(w => Math.max(320, Math.min(720, w - d)))}/>}

      {/* RIGHT RAIL — desktop */}
      {!effectiveNarrow && rightOpen && (
        <div style={{ width:rightW, flex:"0 0 auto" }}>
          <RightRail activePart={activePart} activeDiff={activeDiff} onJumpBack={jumpBack} onClose={onCloseInspector}
            session={active} onJumpToTurn={() => {}} forceTab={forceRailTab} onTabChange={() => setForceRailTab(null)}/>
        </div>
      )}

      {/* Bottom sheet — mobile/narrow */}
      {effectiveNarrow && (
        <>
          <button onClick={()=>setSheetOpen(true)} style={{
            position:"fixed", bottom:48, right:18, zIndex:800, padding:"10px 14px",
            background:"var(--accent)", color:"#fff", border:"none", borderRadius:"var(--r-pill)",
            boxShadow:"var(--shadow-md)", fontFamily:"inherit", fontSize:12, fontWeight:600, cursor:"pointer",
            display:"flex", alignItems:"center", gap:6
          }}>
            <Icon name="tool" size={13}/> Inspector
          </button>
          <div style={{
            position:"fixed", left:0, right:0, bottom: sheetOpen ? 0 : "-78vh", height:"78vh",
            background:"var(--surface)", borderTop:"1px solid var(--border-strong)",
            borderTopLeftRadius:"var(--r-3)", borderTopRightRadius:"var(--r-3)",
            boxShadow:"var(--shadow-lg)", zIndex:950, transition:"bottom 260ms cubic-bezier(.25,.8,.3,1)",
            display:"flex", flexDirection:"column"
          }}>
            <div onClick={()=>setSheetOpen(false)} style={{ padding:"10px 0 6px", textAlign:"center", cursor:"pointer" }}>
              <div style={{ margin:"0 auto", width:38, height:4, borderRadius:99, background:"var(--border-strong)" }}/>
            </div>
            <div style={{ flex:1, minHeight:0 }}>
              <RightRail activePart={activePart} activeDiff={activeDiff} onJumpBack={jumpBack} onClose={onCloseInspector}
                session={active} onJumpToTurn={() => {}} forceTab={forceRailTab} onTabChange={() => setForceRailTab(null)}/>
            </div>
          </div>
          {sheetOpen && <div onClick={()=>setSheetOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(20,18,14,.35)", zIndex:940 }}/>}
        </>
      )}

      <SearchFlyover open={searchOpen} onClose={()=>setSearchOpen(false)} onPickSession={(r) => { setSessionId(r.sessionId); }}/>
    </div>
  );
}

const kbdStyle = {
  fontFamily:"var(--font-mono)", fontSize:10, border:"1px solid var(--border)",
  background:"var(--surface)", padding:"0 5px", borderRadius:4, color:"var(--text-2)", marginRight:3
};

Object.assign(window, { Workspace });
