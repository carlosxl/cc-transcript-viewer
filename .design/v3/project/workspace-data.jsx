// Extended sample data for the Workspace prototype.
// Adds richer parts so the inspector + code rendering have material:
// fenced markdown, syntax highlighting targets, longer tool results,
// failure/streaming states, side-by-side diffs.

const WS_SESSIONS = [
  { id:"s1", title:"Help me mimic the /security-review skill/command to do a full review on https://github.com/carlosxl/cc-transcript-viewer, master branch", ago:"4 seconds ago", msgs:133, cost:"4.8M", units:"15.1m", active:true, project:"cc-transcript-viewer", pinned:true, model:"opus-4.7" },
  { id:"s2", title:"Search Claude/Claude Code's authoritative docs to see if anything was added recently about subagents", ago:"1 min", msgs:8, cost:"211.5K", units:"840k", project:"cc-transcript-viewer", model:"opus-4.7" },
  { id:"s3", title:"[Image #3] I tried twice. Each time the command just silently exited", ago:"13 min", msgs:289, cost:"19.6M", units:"19.6m", project:"cc-transcript-viewer", model:"opus-4.7" },
  { id:"s4", title:"[Image #3] see my screen, those role labels should logically be displayed", ago:"5h", msgs:126, cost:"7.6M", units:"7.6m", project:"cc-transcript-viewer", model:"sonnet-4.5" },
  { id:"s5", title:"Can we in the fix show both token and weighted cost?", ago:"6h", msgs:280, cost:"21.2M", units:"21.2m", project:"cc-transcript-viewer", model:"opus-4.7" },
  { id:"s6", title:"cross-session-full-text-search", ago:"8h", msgs:2, cost:"0", units:"0", project:"cc-transcript-viewer", model:"haiku-4.5" },
  { id:"s7", title:"cross-session-full-text-search", ago:"8h", msgs:17, cost:"373.9K", units:"840k", project:"cc-transcript-viewer", model:"sonnet-4.5" },
  { id:"s8", title:"cross-session-full-text-search", ago:"8h", msgs:251, cost:"14.7M", units:"14.7m", project:"cc-transcript-viewer", model:"opus-4.7" },
  { id:"s9", title:"cross-session-full-text-search", ago:"9h", msgs:360, cost:"35.9M", units:"35.9m", project:"cc-transcript-viewer", model:"opus-4.7" },
  { id:"s10", title:"Not working. Do we have to re-build anything?", ago:"2d", msgs:580, cost:"64.8M", units:"64.8m", project:"cc-transcript-viewer", model:"opus-4.7" },
  { id:"s11", title:"help me verify if the following blog claim is true: The author said", ago:"3d", msgs:8, cost:"178.5K", units:"178k", project:"sandbox", model:"sonnet-4.5" },
  { id:"s12", title:"tried, still not working on screen, can you check the JSONL?", ago:"3d", msgs:222, cost:"11.6M", units:"11.6m", project:"sandbox", model:"opus-4.7" },
  { id:"s13", title:"help me update `~/.claude/settings.json` as well", ago:"3d", msgs:250, cost:"13.9M", units:"13.9m", project:"sandbox", model:"opus-4.7" },
  { id:"s14", title:"proceed", ago:"3d", msgs:80, cost:"2.5M", units:"2.5m", project:"sandbox", model:"sonnet-4.5" },
  { id:"s15", title:"teach how to verify D-40.5", ago:"14d", msgs:317, cost:"69.8M", units:"69.8m", project:"langfuse", model:"opus-4.7" },
  { id:"s16", title:"edit anyway", ago:"14d", msgs:27, cost:"668K", units:"668k", project:"langfuse", model:"sonnet-4.5" },
];

const WS_ACTIVE = {
  ...ACTIVE,
  files: [
    { path:"src/static.ts", reads:2, writes:1, lines:"118–125", changed:true },
    { path:"~/.claude/skills/security-review/SKILL.md", reads:1, writes:0 },
    { path:"~/.claude/commands/", reads:1, writes:0 },
    { path:"/tmp/ccrv/", reads:3, writes:0 },
    { path:"src/jsonl.ts", reads:1, writes:0 },
  ],
};

// Richer transcript with: command, stderr, text, fenced markdown,
// multi-tool turn with success + failure + streaming, side-by-side diff,
// final summary with findings list.
//
// Per-message usage mirrors what's in real Claude Code JSONL:
//   assistant:  { input, output, cache_create, cache_read, ttft_ms,
//                 duration_ms, stop_reason, context_used /* cumulative */ }
//   user:       { chars, est_tokens, attachments }
//   next_turn:  id of the assistant turn this user message feeds into (user only)
const CTX_WINDOW = 200_000;
const WS_MESSAGES = [
  { id:"m1", role:"user", at:"17:29:42", kind:"command", name:"/clear", args:"",
    usage:{ chars:6, est_tokens:3, attachments:[], next_turn:null, note:"Resets context — next turn starts cold." } },
  { id:"m2", role:"user", at:"17:30:36", kind:"command", name:"/security-review",
    args:"this github repo, master branch: https://github.com/carlosxl/cc-transcript-viewer",
    usage:{ chars:92, est_tokens:24, attachments:[{kind:"url", label:"github.com/carlosxl/cc-transcript-viewer"}], next_turn:"m5" } },
  { id:"m3", role:"user", at:"17:30:36", kind:"stderr",
    text: "Error: Shell command failed for pattern \"!`git log --no-decorate origin/HEAD...`\": [stderr]\nfatal: ambiguous argument 'origin/HEAD...': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'",
    usage:{ chars:312, est_tokens:78, attachments:[], next_turn:"m5", note:"Injected as tool-result error; counts toward next turn's input." } },
  { id:"m4", role:"user", at:"17:31:18", kind:"text",
    text: "Help me mimic the /security-review skill/command to do a full review on https://github.com/carlosxl/cc-transcript-viewer, master branch",
    usage:{ chars:137, est_tokens:34, attachments:[], next_turn:"m5" } },

  { id:"m5", role:"assistant", at:"17:31:59", model:"opus-4.7",
    usage:{ input:1842, output:286, cache_create:412, cache_read:0, ttft_ms:612, duration_ms:5_310, stop_reason:"tool_use", context_used:2_540, parts:[
      { type:"think", tokens:138 },
      { type:"tool",  tool:"Bash", tokens:124 },
      { type:"tool",  tool:"Bash", tokens:212 },
      { type:"tool",  tool:"Read", tokens:184 },
    ]},
    parts:[
    { type:"think", text:"I need to understand what the /security-review skill does, then apply that same analysis to the cc-transcript-viewer repository on the master branch. First step: locate the skill definition." },
    { type:"tool", tool:"Bash", status:"ok", duration:"412ms",
      args:{ command:"ls ~/.claude/commands/ 2>/dev/null; ls ~/.claude/skills/ 2>/dev/null", description:"Find security-review command/skill location" },
      result:"conclude-task.md\nlangfuse\nparallel-agent", tokens:124 },
    { type:"tool", tool:"Bash", status:"running", duration:null,
      args:{ command:"find ~/.claude -name \"*security-review*\" 2>/dev/null; find / -name \"security-review*\" -path \"*/commands/*\" 2>/dev/null | head -5", description:"Locate security-review command file" },
      result:"Command running in background with ID: b8uyza6u0.\nOutput is being written to:\n  /private/tmp/claude-501/-Users-l-xiang-sandbox-cc-transcript-viewer/dbb1e532-52da-4cf5-88a3-53239f227776/tasks/b8uyza6u0.output",
      tokens:212, async:true },
    { type:"tool", tool:"Read", status:"ok", duration:"38ms",
      args:{ file_path:"~/.claude/skills/security-review/SKILL.md" },
      result:"# Security Review\n\nFor any code under review, identify HIGH/MEDIUM/LOW severity issues.\nFocus on:\n  - input validation\n  - auth boundaries\n  - secret handling\n  - injection vectors\n\nOutput a Findings table grouped by severity, then a remediation plan.",
      tokens:184 },
  ]},

  { id:"m6", role:"assistant", at:"17:32:48", model:"opus-4.7",
    usage:{ input:3120, output:412, cache_create:0, cache_read:1612, ttft_ms:489, duration_ms:4_120, stop_reason:"tool_use", context_used:5_960, parts:[
      { type:"text", tokens:72 },
      { type:"tool", tool:"Bash", tokens:340 },
    ]},
    parts:[
    { type:"text", text:"I have the skill loaded. Now I'll clone the repository and walk the surface area." },
    { type:"tool", tool:"Bash", status:"ok", duration:"3.1s",
      args:{ command:"git clone https://github.com/carlosxl/cc-transcript-viewer /tmp/ccrv && cd /tmp/ccrv && git log --oneline | head -5", description:"Clone target repo & check recent commits" },
      result:"Cloning into '/tmp/ccrv'...\nremote: Enumerating objects: 412, done.\nReceiving objects: 100% (412/412), 1.2 MiB | 8.1 MiB/s, done.\n\na9c4f12 token report: add cache-hit rate (#42)\n2b71e0a static: serve assets with content-hash\nc88de31 jsonl: tolerate trailing whitespace on schema rows\n11d04bb session list: virtualize > 200 rows\n0e72ba0 docs: getting started",
      tokens:340 },
  ]},

  { id:"m7", role:"user", at:"17:33:55", kind:"text",
    text:"Can you focus on the static asset serving in `static.ts`?",
    usage:{ chars:56, est_tokens:14, attachments:[], next_turn:"m8" } },

  { id:"m8", role:"assistant", at:"17:34:02", model:"opus-4.7",
    usage:{ input:6240, output:1_120, cache_create:0, cache_read:4_980, ttft_ms:521, duration_ms:9_840, stop_reason:"end_turn", context_used:12_390, parts:[
      { type:"think",    tokens:118 },
      { type:"tool",     tool:"Read", tokens:96 },
      { type:"diff",     tokens:142 },
      { type:"markdown", tokens:764 },
    ]},
    parts:[
    { type:"think", text:"User narrowed scope. I should diff the prefix-check logic and surface any path-traversal risk on the loopback-only server." },
    { type:"tool", tool:"Read", status:"ok", duration:"21ms",
      args:{ file_path:"src/static.ts", offset:100, limit:60 },
      result:"// inside serveStatic()\nconst safe = path.normalize(req.url);\nif (!safe.startsWith(ROOT)) return res.writeHead(403).end();\nreturn send(req, safe, { root: ROOT });",
      tokens:96 },
    { type:"diff", file:"src/static.ts", added:6, removed:2, hunk:[
      { type:"ctx", n:118, text:"// inside serveStatic()" },
      { type:"ctx", n:119, text:"const safe = path.normalize(req.url);" },
      { type:"rm",  n:120, text:"if (!safe.startsWith(ROOT)) return res.writeHead(403).end();" },
      { type:"rm",  n:121, text:"return send(req, safe, { root: ROOT });" },
      { type:"add", n:120, text:"const root = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;" },
      { type:"add", n:121, text:"if (!safe.startsWith(root) && safe !== ROOT) {" },
      { type:"add", n:122, text:"  return res.writeHead(403).end();" },
      { type:"add", n:123, text:"}" },
      { type:"add", n:124, text:"return send(req, safe, { root: ROOT });" },
      { type:"ctx", n:125, text:"// (existing 404 branch below unchanged)" },
    ]},
    { type:"markdown", text: "### Summary\n\nThe codebase shows deliberate, well-commented defensive design. **No high-severity issues found.** Two low-severity hardening items, plus a handful of informational notes worth documenting in a threat-model section.\n\n#### Findings\n\n- **LOW** — `static.ts:122` prefix check without separator boundary. `safe.startsWith(ROOT)` matches `/srv/app-evil` against root `/srv/app`. Bound to loopback so blast radius is limited, but worth tightening — patch above.\n- **LOW** — `jsonl.ts:54` schema row parser does not bound line length; a malformed transcript could allocate unboundedly. Recommend a 1 MiB per-line cap with a clear error.\n- **INFO** — `package.json` pins direct deps but not transitives; consider `npm shrinkwrap` for releases.\n\n#### Out of scope\n\nThis review covers `master @ a9c4f12`. Sub-commands invoked by the viewer (`tail -f`, `jq`) run on a developer laptop bound to loopback; trust boundary documentation would help reviewers."
    },
  ]},
];

// Per-model USD rates (per 1M tokens) — illustrative figures for the design.
const MODEL_RATES = {
  "opus-4.7":   { in: 15.00, out: 75.00, cache_create: 18.75, cache_read: 1.50 },
  "sonnet-4.5": { in:  3.00, out: 15.00, cache_create:  3.75, cache_read: 0.30 },
  "haiku-4.5":  { in:  0.80, out:  4.00, cache_create:  1.00, cache_read: 0.08 },
};

function estimateCost(model, u) {
  const r = MODEL_RATES[model] || MODEL_RATES["opus-4.7"];
  return ((u.input||0) * r.in + (u.output||0) * r.out
        + (u.cache_create||0) * r.cache_create + (u.cache_read||0) * r.cache_read) / 1_000_000;
}

Object.assign(window, { WS_SESSIONS, WS_ACTIVE, WS_MESSAGES, MODEL_RATES, CTX_WINDOW, estimateCost });
