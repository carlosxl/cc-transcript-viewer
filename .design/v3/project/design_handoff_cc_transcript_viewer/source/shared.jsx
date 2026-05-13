// Shared bits across variations — icons, theme toggle, code/diff blocks.

// Lucide-style inline icons (single source of truth, no CDN dependency).
function Icon({ name, size=16, stroke=1.6, style }) {
  const s = { width:size, height:size, fill:"none", stroke:"currentColor",
              strokeWidth:stroke, strokeLinecap:"round", strokeLinejoin:"round",
              vectorEffect:"non-scaling-stroke", style };
  const P = (d, extra) => <svg viewBox="0 0 24 24" {...s}><path d={d}/>{extra}</svg>;
  switch (name) {
    case "search":    return P("M21 21l-4.3-4.3", <circle cx="11" cy="11" r="7"/>);
    case "filter":    return P("M3 5h18M6 12h12M10 19h4");
    case "chart":     return P("M3 3v18h18", <><path d="M7 14l3-3 3 3 4-5"/></>);
    case "close":     return P("M18 6 6 18M6 6l12 12");
    case "info":      return P("M12 16v-5M12 8h.01", <circle cx="12" cy="12" r="9"/>);
    case "chevron-down": return P("m6 9 6 6 6-6");
    case "chevron-right": return P("m9 6 6 6-6 6");
    case "chevron-left":  return P("m15 6-6 6 6 6");
    case "user":      return P("M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", <circle cx="12" cy="7" r="4"/>);
    case "bot":       return P("M12 2v3M5 9h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM9 14h.01M15 14h.01");
    case "spark":     return P("M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1");
    case "tool":      return P("M14.7 6.3a4 4 0 0 1 5 5l-1.7 1.7-5-5 1.7-1.7zM4 20l5-1 8.3-8.3-4-4L5 15l-1 5z");
    case "terminal":  return P("m4 17 6-6-6-6M12 19h8");
    case "code":      return P("m16 18 6-6-6-6M8 6l-6 6 6 6");
    case "play":      return P("M5 3v18l15-9z");
    case "check":     return P("M20 6 9 17l-5-5");
    case "copy":      return P("M9 9h11v11H9zM5 5h11v3M5 5v11h3");
    case "download":  return P("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3");
    case "sun":       return P("M4 12H1m22 0h-3M5.6 5.6 3.5 3.5m17 17-2.1-2.1M5.6 18.4l-2.1 2.1m17-17-2.1 2.1M12 21v-3m0-12V3", <circle cx="12" cy="12" r="4"/>);
    case "moon":      return P("M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z");
    case "pin":       return P("M12 17v5M5 9h14l-2 6H7L5 9zM7 9l1-6h8l1 6");
    case "folder":    return P("M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z");
    case "command":   return P("M9 3a3 3 0 0 0-3 3v3H3M21 9h-3V6a3 3 0 0 0-3-3M3 15h3v3a3 3 0 0 0 3 3M15 21a3 3 0 0 0 3-3v-3h3M9 9h6v6H9z");
    case "warn":      return P("M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z");
    case "ext":       return P("M14 3h7v7M10 14 21 3M5 5h6v0M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6");
    case "menu":      return P("M3 6h18M3 12h18M3 18h18");
    case "more":      return <svg viewBox="0 0 24 24" {...s}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>;
    case "x":         return P("M18 6 6 18M6 6l12 12");
    case "side":      return P("M3 5h18v14H3zM9 5v14");
    case "list":      return P("M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01");
    case "git":       return P("M6 3v12a3 3 0 1 0 3 3", <><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v3a3 3 0 0 1-3 3H9"/></>);
    case "spinner":   return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9" strokeDasharray="42 60" strokeLinecap="round"/></svg>;
    case "diff":      return P("M9 3v12M3 9h12M9 21h12M15 15v12");
    case "hash":      return P("M4 9h16M4 15h16M10 3 8 21M16 3l-2 18");
    case "circle":    return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>;
    case "stop":      return P("M5 5h14v14H5z");
    case "star":      return P("m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z");
    default: return null;
  }
}

// Theme toggle — flips the data-theme on the closest mock wrapper.
function ThemeToggle({ theme, onChange, compact }) {
  return (
    <button
      onClick={() => onChange(theme === "dark" ? "light" : "dark")}
      className="cc-btn cc-btn-ghost"
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      style={{ display:"inline-flex", alignItems:"center", gap:6, padding: compact ? "4px 8px" : "6px 10px",
               border:"1px solid var(--border)", borderRadius:"var(--r-pill)", background:"var(--surface)",
               color:"var(--text-2)", cursor:"pointer", fontSize:12 }}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={14}/>
      {!compact && <span>{theme === "dark" ? "Light" : "Dark"}</span>}
    </button>
  );
}

// Pretty token chip: label + value, used by header & metrics panel.
function MetricChip({ label, value, tone, mono, dense }) {
  const toneStyle = tone === "accent" ? { color:"var(--accent-text)" }
                  : tone === "muted"  ? { color:"var(--text-3)" }
                  : { color:"var(--text)" };
  return (
    <div style={{ display:"inline-flex", flexDirection: dense ? "row" : "column", alignItems: dense ? "baseline" : "flex-start", gap: dense ? 6 : 2 }}>
      <span style={{ fontSize:10.5, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:500 }}>{label}</span>
      <span style={{ fontFamily:mono ? "var(--font-mono)" : "inherit", fontSize: dense ? 13 : 15, fontWeight: 500, ...toneStyle }}>{value}</span>
    </div>
  );
}

// Code block with optional copy button, line numbers, language tag.
function CodeBlock({ language, code, lines, dense, lineNumbers }) {
  const rows = (code ?? "").split("\n");
  return (
    <div style={{ background:"var(--code-bg)", border:"1px solid var(--code-border)", borderRadius:"var(--r-2)", overflow:"hidden" }}>
      {language && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px 6px 12px",
                      borderBottom:"1px solid var(--code-border)", background:"var(--surface-2)" }}>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)", textTransform:"lowercase" }}>{language}</span>
          <button className="cc-btn-icon" style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, color:"var(--text-3)",
                       background:"transparent", border:"none", cursor:"pointer", padding:"2px 6px", borderRadius:6 }}>
            <Icon name="copy" size={11}/> Copy
          </button>
        </div>
      )}
      <div style={{ display:"flex", fontFamily:"var(--font-mono)", fontSize: dense ? 11.5 : 12.5, lineHeight: 1.55, color:"var(--code-text)" }}>
        {lineNumbers !== false && (
          <div aria-hidden style={{ padding:"10px 10px 10px 14px", color:"var(--text-4)", textAlign:"right",
                  borderRight:"1px solid var(--code-border)", userSelect:"none", flex:"0 0 auto" }}>
            {rows.map((_, i) => <div key={i}>{i+1}</div>)}
          </div>
        )}
        <pre style={{ margin:0, padding:"10px 14px", flex:1, overflow:"auto", whiteSpace:"pre", fontFamily:"inherit" }}>{code}</pre>
      </div>
    </div>
  );
}

// Unified diff renderer
function DiffBlock({ file, added, removed, hunk }) {
  return (
    <div style={{ background:"var(--code-bg)", border:"1px solid var(--code-border)", borderRadius:"var(--r-2)", overflow:"hidden" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 12px",
                    borderBottom:"1px solid var(--code-border)", background:"var(--surface-2)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Icon name="diff" size={12} style={{ color:"var(--text-3)" }}/>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:11.5, color:"var(--text-2)" }}>{file}</span>
        </div>
        <div style={{ display:"flex", gap:8, fontFamily:"var(--font-mono)", fontSize:11 }}>
          <span style={{ color:"var(--diff-add-text)" }}>+{added}</span>
          <span style={{ color:"var(--diff-rm-text)" }}>−{removed}</span>
        </div>
      </div>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:12, lineHeight:1.55 }}>
        {hunk.map((row, i) => {
          const bg = row.type === "add" ? "var(--diff-add-bg)" : row.type === "rm" ? "var(--diff-rm-bg)" : "transparent";
          const fg = row.type === "add" ? "var(--diff-add-text)" : row.type === "rm" ? "var(--diff-rm-text)" : "var(--code-text)";
          const gutter = row.type === "add" ? "var(--diff-add-gutter)" : row.type === "rm" ? "var(--diff-rm-gutter)" : "var(--code-border)";
          const marker = row.type === "add" ? "+" : row.type === "rm" ? "−" : " ";
          return (
            <div key={i} style={{ display:"flex", background:bg, color:fg }}>
              <div style={{ width:50, textAlign:"right", padding:"0 8px", borderRight:`2px solid ${gutter}`, color:"var(--text-4)", userSelect:"none", flex:"0 0 auto" }}>{row.n ?? ""}</div>
              <div style={{ width:18, textAlign:"center", color: row.type === "ctx" ? "var(--text-4)" : "inherit", flex:"0 0 auto" }}>{marker}</div>
              <div style={{ padding:"0 8px 0 4px", whiteSpace:"pre", overflow:"auto" }}>{row.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Markdown-ish text: turn `inline` and **bold** into formatted spans.
function RichText({ text, style }) {
  const parts = [];
  let rest = text;
  let key = 0;
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let m, last = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("`")) {
      parts.push(<code key={++key} style={{ fontFamily:"var(--font-mono)", fontSize:".92em", background:"var(--surface-2)", padding:"1px 5px", borderRadius:4 }}>{t.slice(1,-1)}</code>);
    } else {
      parts.push(<strong key={++key} style={{ fontWeight:600 }}>{t.slice(2,-2)}</strong>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span style={style}>{parts}</span>;
}

Object.assign(window, { Icon, ThemeToggle, MetricChip, CodeBlock, DiffBlock, RichText });
