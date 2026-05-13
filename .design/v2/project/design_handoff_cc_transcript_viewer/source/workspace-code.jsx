// Syntax highlighter + code/diff blocks for the Workspace.
// Tiny rule-based highlighter — no CDN, no dep. Covers bash, ts/js,
// json, md well enough for prototype hi-fi.

function highlight(code, lang) {
  if (!code) return [{ t: "", c: null }];
  const toks = [];
  let rest = code;
  const push = (t, c) => toks.push({ t, c });

  const rules = {
    bash: [
      { re: /^#[^\n]*/, c: "comment" },
      { re: /^"(?:\\.|[^"\\])*"/, c: "string" },
      { re: /^'(?:\\.|[^'\\])*'/, c: "string" },
      { re: /^`(?:\\.|[^`\\])*`/, c: "string" },
      { re: /^\$\{[^}]+\}/, c: "var" },
      { re: /^\$[A-Za-z_][\w]*/, c: "var" },
      { re: /^--?[A-Za-z][\w-]*/, c: "flag" },
      { re: /^\b(if|then|else|fi|for|do|done|while|case|esac|in|function|return|export|local|cd|exit)\b/, c: "kw" },
      { re: /^\b(ls|find|grep|awk|sed|cat|head|tail|cp|mv|rm|mkdir|echo|git|npm|node|curl|jq|tr|wc|sort|uniq|xargs)\b/, c: "fn" },
      { re: /^[|&;<>(){}[\]]/, c: "punct" },
      { re: /^\d+/, c: "num" },
      { re: /^\s+/, c: null },
      { re: /^[A-Za-z_][\w.\/~-]*/, c: null },
      { re: /^./, c: null },
    ],
    ts: [
      { re: /^\/\/[^\n]*/, c: "comment" },
      { re: /^\/\*[\s\S]*?\*\//, c: "comment" },
      { re: /^"(?:\\.|[^"\\])*"/, c: "string" },
      { re: /^'(?:\\.|[^'\\])*'/, c: "string" },
      { re: /^`(?:\\.|[^`\\])*`/, c: "string" },
      { re: /^\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|from|export|default|async|await|typeof|in|of|try|catch|finally|throw)\b/, c: "kw" },
      { re: /^\b(true|false|null|undefined|this)\b/, c: "lit" },
      { re: /^\b([A-Z][\w]*)\b/, c: "type" },
      { re: /^\b([a-z_][\w]*)(?=\s*\()/, c: "fn" },
      { re: /^\d+\.?\d*/, c: "num" },
      { re: /^[+\-*/=<>!&|?:]+/, c: "op" },
      { re: /^[{}()[\];,.]/, c: "punct" },
      { re: /^\s+/, c: null },
      { re: /^[A-Za-z_$][\w$]*/, c: null },
      { re: /^./, c: null },
    ],
    json: [
      { re: /^"(?:\\.|[^"\\])*"(?=\s*:)/, c: "key" },
      { re: /^"(?:\\.|[^"\\])*"/, c: "string" },
      { re: /^\b(true|false|null)\b/, c: "lit" },
      { re: /^-?\d+\.?\d*/, c: "num" },
      { re: /^[{}[\]:,]/, c: "punct" },
      { re: /^\s+/, c: null },
      { re: /^./, c: null },
    ],
    md: [
      { re: /^#{1,6}[^\n]*/, c: "heading" },
      { re: /^`[^`]+`/, c: "code" },
      { re: /^\*\*[^*]+\*\*/, c: "bold" },
      { re: /^\s+/, c: null },
      { re: /^\w+/, c: null },
      { re: /^./, c: null },
    ],
  };
  const set = rules[lang] || rules.ts;
  let guard = 0;
  while (rest.length && guard++ < 50000) {
    let matched = false;
    for (const r of set) {
      const m = rest.match(r.re);
      if (m) { push(m[0], r.c); rest = rest.slice(m[0].length); matched = true; break; }
    }
    if (!matched) { push(rest[0], null); rest = rest.slice(1); }
  }
  return toks;
}

const TOKEN_COLORS = {
  comment: "var(--text-3)",
  string:  "#8A6F3F",
  key:     "#3F6F8A",
  var:     "#7A5AE0",
  flag:    "#6B6B6B",
  kw:      "#A04A7B",
  fn:      "#3F6F8A",
  type:    "#8A3F6F",
  lit:     "#A04A7B",
  num:     "#7A5AE0",
  op:      "#6B6B6B",
  punct:   "#8B867D",
  heading: "var(--accent-text)",
  code:    "#8A6F3F",
  bold:    "var(--text)",
};

function HighlightedCode({ code, lang, lineNumbers=true, dense=false }) {
  const lines = (code ?? "").split("\n");
  return (
    <div style={{ display:"flex", fontFamily:"var(--font-mono)", fontSize: dense ? 11.5 : 12.5, lineHeight:1.55, color:"var(--code-text)" }}>
      {lineNumbers && (
        <div aria-hidden style={{ padding:"10px 10px 10px 14px", color:"var(--text-4)", textAlign:"right",
                borderRight:"1px solid var(--code-border)", userSelect:"none", flex:"0 0 auto", background:"var(--surface-2)" }}>
          {lines.map((_, i) => <div key={i}>{i+1}</div>)}
        </div>
      )}
      <pre style={{ margin:0, padding:"10px 14px", flex:1, overflow:"auto", whiteSpace:"pre", fontFamily:"inherit" }}>
        {highlight(code, lang).map((tk, i) =>
          tk.c ? <span key={i} style={{ color: TOKEN_COLORS[tk.c] || "inherit", fontWeight: tk.c === "bold" ? 600 : 400 }}>{tk.t}</span> : tk.t
        )}
      </pre>
    </div>
  );
}

function CodeCard({ code, lang, label, actions, lineNumbers=true, dense=false }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    try { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch(_){}
  };
  return (
    <div style={{ background:"var(--code-bg)", border:"1px solid var(--code-border)", borderRadius:"var(--r-2)", overflow:"hidden" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px 6px 12px",
                    borderBottom:"1px solid var(--code-border)", background:"var(--surface-2)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-3)" }}>{lang || ""}</span>
          {label && <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-2)" }}>· {label}</span>}
        </div>
        <div style={{ display:"flex", gap:4 }}>
          {actions}
          <button onClick={copy} className="cc-icon-btn" title="Copy">
            <Icon name={copied ? "check" : "copy"} size={11}/>{copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <HighlightedCode code={code} lang={lang} lineNumbers={lineNumbers} dense={dense}/>
    </div>
  );
}

// Side-by-side diff
function SideBySideDiff({ file, added, removed, hunk }) {
  const left = [];   // rm + ctx
  const right = [];  // add + ctx
  hunk.forEach(row => {
    if (row.type === "ctx") { left.push(row); right.push(row); }
    else if (row.type === "rm") { left.push(row); right.push({ type:"pad" }); }
    else if (row.type === "add") { left.push({ type:"pad" }); right.push(row); }
  });
  const renderSide = (rows, side) => rows.map((r, i) => {
    const bg = r.type === "add" ? "var(--diff-add-bg)" : r.type === "rm" ? "var(--diff-rm-bg)" : r.type === "pad" ? "var(--surface-inset)" : "transparent";
    const fg = r.type === "add" ? "var(--diff-add-text)" : r.type === "rm" ? "var(--diff-rm-text)" : "var(--code-text)";
    return (
      <div key={i} style={{ display:"flex", background:bg, color:fg, minHeight:20 }}>
        <div style={{ width:36, textAlign:"right", padding:"0 6px", color:"var(--text-4)", userSelect:"none", flex:"0 0 auto", fontSize:11 }}>{r.n ?? ""}</div>
        <div style={{ padding:"0 8px", whiteSpace:"pre", overflow:"auto", flex:1 }}>{r.text ?? ""}</div>
      </div>
    );
  });
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
      <div style={{ display:"flex", fontFamily:"var(--font-mono)", fontSize:12, lineHeight:1.55 }}>
        <div style={{ flex:1, borderRight:"1px solid var(--code-border)" }}>{renderSide(left, "L")}</div>
        <div style={{ flex:1 }}>{renderSide(right, "R")}</div>
      </div>
    </div>
  );
}

// Markdown-ish renderer — headings, bold, inline code, lists, paragraphs.
function Markdown({ text }) {
  const blocks = text.split(/\n\n+/);
  return blocks.map((b, i) => {
    const trimmed = b.trim();
    // Heading
    const h = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      const level = h[1].length;
      const sz = [22, 18, 15, 13.5][level-1];
      const Tag = "h" + Math.min(level+1, 6);
      return <Tag key={i} style={{ margin:"14px 0 6px", fontSize:sz, fontWeight:600, letterSpacing:"-.005em", color:"var(--text)" }}>{h[2]}</Tag>;
    }
    // List
    if (/^[-*]\s/.test(trimmed)) {
      const items = trimmed.split(/\n/).map(l => l.replace(/^[-*]\s+/, ""));
      return (
        <ul key={i} style={{ margin:"6px 0 6px 4px", padding:"0 0 0 16px", color:"var(--text)", fontSize:13.5, lineHeight:1.65 }}>
          {items.map((it, j) => <li key={j} style={{ marginBottom:3 }}><RichText text={it}/></li>)}
        </ul>
      );
    }
    return <p key={i} style={{ margin:"6px 0", fontSize:13.5, lineHeight:1.65, color:"var(--text)" }}><RichText text={trimmed}/></p>;
  });
}

Object.assign(window, { HighlightedCode, CodeCard, SideBySideDiff, Markdown });
