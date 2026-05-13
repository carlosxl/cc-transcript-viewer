// Cross-session search flyover (Cmd/Ctrl+K).
// Searches across all sessions + tool calls + file paths with filters.

function SearchFlyover({ open, onClose, onPickSession }) {
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState("all"); // all|sessions|tools|files
  const [sel, setSel] = React.useState(0);
  const inputRef = React.useRef(null);
  React.useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open]);

  // Build searchable corpus
  const results = React.useMemo(() => {
    if (!q.trim()) return [];
    const needle = q.toLowerCase();
    const r = [];
    if (filter === "all" || filter === "sessions") {
      WS_SESSIONS.forEach(s => {
        if (s.title.toLowerCase().includes(needle))
          r.push({ kind:"session", sessionId:s.id, title:s.title, sub:`${s.project} · ${s.ago} · ${s.msgs} msgs`, icon:"chat" });
      });
    }
    if (filter === "all" || filter === "tools") {
      WS_MESSAGES.forEach(m => {
        if (m.role !== "assistant") return;
        m.parts.forEach((p, i) => {
          if (p.type === "tool") {
            const text = (p.tool + " " + (p.args?.command || p.args?.file_path || p.args?.description || "")).toLowerCase();
            if (text.includes(needle))
              r.push({ kind:"tool", sessionId:"s1", title:`${p.tool} · ${p.args?.command || p.args?.file_path || ""}`,
                       sub:`turn ${m.id} · ${p.duration || ""}`, icon: p.tool === "Bash" ? "terminal" : "code" });
          }
        });
      });
    }
    if (filter === "all" || filter === "files") {
      WS_ACTIVE.files.forEach(f => {
        if (f.path.toLowerCase().includes(needle))
          r.push({ kind:"file", sessionId:"s1", title:f.path, sub:`${f.reads} reads · ${f.writes} writes`, icon:"code" });
      });
    }
    return r.slice(0, 40);
  }, [q, filter]);

  React.useEffect(() => { setSel(0); }, [q, filter]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && results[sel]) { e.preventDefault(); onPickSession(results[sel]); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, sel]);

  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(20,18,14,.42)", zIndex:1000, display:"flex", justifyContent:"center", paddingTop:"10vh" }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width: "min(640px, 92vw)", height:"fit-content", maxHeight:"70vh", background:"var(--surface)",
        border:"1px solid var(--border)", borderRadius:"var(--r-3)", boxShadow:"var(--shadow-lg)",
        display:"flex", flexDirection:"column", overflow:"hidden"
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", borderBottom:"1px solid var(--border)" }}>
          <Icon name="search" size={14} style={{ color:"var(--text-3)" }}/>
          <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)}
            placeholder="Search across all sessions, tool calls, and files…"
            style={{ flex:1, fontSize:14, border:"none", outline:"none", background:"transparent", color:"var(--text)", fontFamily:"inherit" }}/>
          <kbd style={{ fontFamily:"var(--font-mono)", fontSize:10.5, border:"1px solid var(--border)",
                       background:"var(--surface-2)", padding:"1px 6px", borderRadius:4, color:"var(--text-3)" }}>Esc</kbd>
        </div>
        <div style={{ display:"flex", gap:4, padding:"7px 12px", borderBottom:"1px solid var(--border)", background:"var(--surface-2)" }}>
          {[
            {id:"all", label:"All"},
            {id:"sessions", label:"Sessions", icon:"chat"},
            {id:"tools", label:"Tool calls", icon:"tool"},
            {id:"files", label:"Files", icon:"code"},
          ].map(f => (
            <button key={f.id} onClick={()=>setFilter(f.id)} style={{
              padding:"4px 10px", fontSize:11.5, fontFamily:"inherit",
              background: filter===f.id ? "var(--accent-soft)" : "transparent",
              color: filter===f.id ? "var(--accent-text)" : "var(--text-3)",
              border:"1px solid", borderColor: filter===f.id ? "var(--accent)" : "transparent",
              borderRadius:"var(--r-pill)", cursor:"pointer", fontWeight: filter===f.id ? 600 : 500
            }}>{f.label}</button>
          ))}
        </div>
        <div className="scroll" style={{ flex:1, overflow:"auto", padding:"6px 0" }}>
          {!q.trim() && (
            <div style={{ padding:"40px 20px", textAlign:"center", color:"var(--text-3)" }}>
              <Icon name="search" size={22} style={{ color:"var(--text-4)" }}/>
              <div style={{ marginTop:8, fontSize:12.5 }}>Search across {WS_SESSIONS.length} sessions</div>
              <div style={{ marginTop:14, display:"flex", justifyContent:"center", gap:8, fontFamily:"var(--font-mono)", fontSize:11 }}>
                {["security review", "static.ts", "Bash", "token report"].map(s =>
                  <button key={s} onClick={()=>setQ(s)} className="cc-icon-btn" style={{ border:"1px solid var(--border)", padding:"3px 8px" }}>{s}</button>
                )}
              </div>
            </div>
          )}
          {q.trim() && results.length === 0 && (
            <div style={{ padding:"30px 20px", textAlign:"center", color:"var(--text-3)", fontSize:12.5 }}>
              No matches for <span style={{ fontFamily:"var(--font-mono)", color:"var(--text-2)" }}>"{q}"</span>
            </div>
          )}
          {results.map((r, i) => (
            <button key={i} onClick={()=>{ onPickSession(r); onClose(); }}
              onMouseEnter={()=>setSel(i)}
              style={{ display:"flex", alignItems:"center", gap:11, width:"100%", padding:"9px 16px", border:"none",
                       background: i === sel ? "var(--accent-soft)" : "transparent",
                       cursor:"pointer", textAlign:"left", fontFamily:"inherit",
                       borderLeft: i === sel ? "2px solid var(--accent)" : "2px solid transparent" }}>
              <Icon name={r.icon === "chat" ? "list" : r.icon} size={14} style={{ color: i === sel ? "var(--accent-text)" : "var(--text-3)", flex:"0 0 auto" }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{highlightMatch(r.title, q)}</div>
                <div style={{ fontSize:11, color:"var(--text-3)", fontFamily:"var(--font-mono)", marginTop:1 }}>{r.sub}</div>
              </div>
              <div style={{ fontSize:10, color:"var(--text-3)", fontFamily:"var(--font-mono)", textTransform:"uppercase", letterSpacing:".06em" }}>{r.kind}</div>
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:14, padding:"7px 14px", borderTop:"1px solid var(--border)",
                       background:"var(--surface-2)", fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--text-3)" }}>
          <span><kbd style={kbdStyleSm}>↑↓</kbd> navigate</span>
          <span><kbd style={kbdStyleSm}>↵</kbd> open</span>
          <span><kbd style={kbdStyleSm}>Esc</kbd> close</span>
          <span style={{ flex:1 }}/>
          <span>{results.length} result{results.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}

function highlightMatch(text, q) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (<>
    {text.slice(0, idx)}
    <mark style={{ background:"var(--accent-soft)", color:"var(--accent-text)", padding:"0 2px", borderRadius:3 }}>{text.slice(idx, idx + q.length)}</mark>
    {text.slice(idx + q.length)}
  </>);
}

const kbdStyleSm = {
  fontFamily:"var(--font-mono)", fontSize:10, border:"1px solid var(--border)",
  background:"var(--surface)", padding:"0 5px", borderRadius:4, color:"var(--text-2)", marginRight:3
};

Object.assign(window, { SearchFlyover });
