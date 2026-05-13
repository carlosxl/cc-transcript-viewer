// Tool inspector v2 — tabs (Call · Result · Diff · Preview · Raw), copy-as-curl, jump-back.

function Tab({ active, onClick, children, count }) {
  return (
    <button onClick={onClick} style={{
      padding:"7px 10px", fontSize:12, fontWeight: active ? 600 : 500,
      color: active ? "var(--text)" : "var(--text-3)",
      background:"transparent", border:"none", borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
      cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6, fontFamily:"inherit"
    }}>
      {children}
      {count != null && <span style={{ fontSize:10.5, color:"var(--text-3)", fontFamily:"var(--font-mono)" }}>{count}</span>}
    </button>
  );
}

function toCurl(part) {
  if (part.tool === "Bash") {
    return `# Bash via Claude Code\n${part.args.command}`;
  }
  if (part.tool === "Read") {
    return `cat ${JSON.stringify(part.args.file_path)}${part.args.offset ? ` | sed -n '${part.args.offset+1},${(part.args.offset+(part.args.limit||50))}p'` : ""}`;
  }
  return `# tool=${part.tool}\n${JSON.stringify(part.args, null, 2)}`;
}

function ToolHeader({ part, onJumpBack }) {
  const tint = part.status === "fail" ? "var(--danger-soft)"
            : part.status === "running" ? "var(--warn-soft)"
            : "var(--success-soft)";
  const text = part.status === "fail" ? "var(--danger)"
            : part.status === "running" ? "var(--warn)"
            : "var(--success)";
  const label = part.status === "fail" ? "Failed" : part.status === "running" ? "Running" : "Succeeded";
  return (
    <div style={{ padding:"14px 18px 12px", borderBottom:"1px solid var(--border)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em" }}>Tool call</span>
        <span style={{ flex:1 }}/>
        <button onClick={onJumpBack} className="cc-icon-btn" title="Jump to message">
          <Icon name="chevron-left" size={11}/> Jump back
        </button>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center",
                       background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", color:"var(--text-2)" }}>
          <Icon name={part.tool === "Bash" ? "terminal" : part.tool === "Read" ? "code" : "tool"} size={15}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:14, color:"var(--text)", fontWeight:600 }}>{part.tool}</div>
          <div style={{ fontSize:12, color:"var(--text-3)" }}>{part.args?.description || part.args?.file_path || ""}</div>
        </div>
        <div style={{ display:"inline-flex", alignItems:"center", gap:5, background:tint, color:text,
                      padding:"4px 9px", borderRadius:"var(--r-pill)", fontSize:11, fontWeight:600 }}>
          {part.status === "running" ? <Icon name="spinner" size={11}/> : <Icon name={part.status === "fail" ? "warn" : "check"} size={11}/>}
          {label}
        </div>
      </div>
      <div style={{ display:"flex", gap:14, marginTop:10, fontSize:11, color:"var(--text-3)", fontFamily:"var(--font-mono)" }}>
        {part.duration && <span>⏱ {part.duration}</span>}
        {part.tokens != null && <span>↯ {part.tokens} tok</span>}
        {part.async && <span style={{ color:"var(--warn)" }}>● async / background</span>}
      </div>
    </div>
  );
}

function InspectorBody({ part, tab }) {
  if (tab === "call") {
    const code = part.tool === "Bash" ? part.args.command
              : JSON.stringify(part.args, null, 2);
    return (
      <div style={{ display:"grid", gap:12 }}>
        <CodeCard code={code} lang={part.tool === "Bash" ? "bash" : "json"} label="arguments"/>
        {part.args?.description && (
          <div style={{ fontSize:12, color:"var(--text-2)", padding:"6px 4px" }}>
            <span style={{ color:"var(--text-3)", fontSize:11, textTransform:"uppercase", letterSpacing:".06em", marginRight:8 }}>Description</span>
            {part.args.description}
          </div>
        )}
      </div>
    );
  }
  if (tab === "result") {
    if (part.status === "running") {
      return (
        <div style={{ padding:"24px", textAlign:"center", color:"var(--text-3)" }}>
          <Icon name="spinner" size={20}/>
          <div style={{ marginTop:8, fontSize:12 }}>Streaming — tail in background task</div>
          {part.result && (
            <pre style={{ marginTop:14, padding:12, background:"var(--code-bg)", border:"1px solid var(--code-border)", borderRadius:"var(--r-2)",
                          textAlign:"left", fontFamily:"var(--font-mono)", fontSize:11.5, color:"var(--text-2)", whiteSpace:"pre-wrap" }}>{part.result}</pre>
          )}
        </div>
      );
    }
    return <CodeCard code={part.result || "(empty)"} lang={part.tool === "Read" ? "ts" : "bash"} label="stdout"/>;
  }
  if (tab === "diff") {
    return <SideBySideDiff {...part._diff}/>;
  }
  if (tab === "preview") {
    // Render result as file preview if it looks like a file
    return (
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:14 }}>
        <div style={{ fontSize:11, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>{part.args?.file_path || "preview"}</div>
        <HighlightedCode code={part.result || ""} lang="ts" lineNumbers={true}/>
      </div>
    );
  }
  if (tab === "raw") {
    return <CodeCard code={JSON.stringify(part, null, 2)} lang="json" label="raw part"/>;
  }
  return null;
}

function Inspector({ part, diff, onJumpBack, onClose }) {
  const [tab, setTab] = React.useState("result");
  React.useEffect(() => { setTab(diff ? "diff" : part?.tool === "Read" ? "preview" : "result"); }, [part]);

  if (!part && !diff) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                    height:"100%", color:"var(--text-3)", textAlign:"center", padding:32, gap:14 }}>
        <div style={{ width:54, height:54, borderRadius:"50%", background:"var(--surface-2)", border:"1px dashed var(--border-strong)",
                       display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Icon name="tool" size={22} style={{ color:"var(--text-4)" }}/>
        </div>
        <div>
          <div style={{ fontSize:13.5, fontWeight:600, color:"var(--text-2)" }}>Tool inspector</div>
          <div style={{ marginTop:4, fontSize:12, maxWidth:260, lineHeight:1.55 }}>Click any tool capsule or diff in the transcript to inspect arguments, results, and changes.</div>
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

  // Diff mode (assistant diff part, not a tool call)
  if (diff) {
    const tabs = ["diff", "raw"];
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
        <div style={{ padding:"14px 18px 12px", borderBottom:"1px solid var(--border)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em" }}>File change</span>
            <span style={{ flex:1 }}/>
            <button onClick={onJumpBack} className="cc-icon-btn"><Icon name="chevron-left" size={11}/> Jump back</button>
            <button onClick={onClose} className="cc-icon-btn"><Icon name="x" size={11}/></button>
          </div>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--text)", fontWeight:600 }}>{diff.file}</div>
          <div style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>
            <span style={{ color:"var(--diff-add-text)" }}>+{diff.added}</span>
            {" / "}
            <span style={{ color:"var(--diff-rm-text)" }}>−{diff.removed}</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:0, padding:"0 12px", borderBottom:"1px solid var(--border)", background:"var(--surface-2)" }}>
          {tabs.map(t => <Tab key={t} active={tab===t} onClick={()=>setTab(t)}>{t.toUpperCase()}</Tab>)}
        </div>
        <div className="scroll" style={{ flex:1, overflow:"auto", padding:14, background:"var(--surface-inset)" }}>
          {tab === "diff" ? <SideBySideDiff {...diff}/> : <CodeCard code={JSON.stringify(diff, null, 2)} lang="json"/>}
        </div>
      </div>
    );
  }

  const allTabs = [
    { id:"call", label:"Call" },
    { id:"result", label:"Result" },
    part.tool === "Read" && { id:"preview", label:"Preview" },
    { id:"raw", label:"Raw" },
  ].filter(Boolean);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <ToolHeader part={part} onJumpBack={onJumpBack}/>
      <div style={{ display:"flex", gap:0, padding:"0 12px", borderBottom:"1px solid var(--border)", background:"var(--surface-2)", justifyContent:"space-between" }}>
        <div style={{ display:"flex" }}>
          {allTabs.map(t => <Tab key={t.id} active={tab===t.id} onClick={()=>setTab(t.id)}>{t.label}</Tab>)}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 0" }}>
          <button className="cc-icon-btn" onClick={() => navigator.clipboard?.writeText(toCurl(part))} title="Copy as runnable command">
            <Icon name="terminal" size={11}/> Copy as curl
          </button>
          <button className="cc-icon-btn" title="Re-run with edits">
            <Icon name="play" size={11}/> Re-run
          </button>
        </div>
      </div>
      <div className="scroll" style={{ flex:1, overflow:"auto", padding:14, background:"var(--surface-inset)" }}>
        <InspectorBody part={part} tab={tab}/>
      </div>
    </div>
  );
}

Object.assign(window, { Inspector });
