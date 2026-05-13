// Shared sample transcript data — used across all three variations
// so the comparison stays apples-to-apples.

const SESSIONS = [
  { id:"s1", title:"Help me mimic the /security-review skill/command to do a full review on https://github.com/carlosxl/cc-transcript-viewer, master branch", ago:"4 seconds ago", msgs:133, cost:"4.8M", active:true, project:"cc-transcript-viewer", pinned:true },
  { id:"s2", title:"Search Claude/Claude Code's authoritative docs to see if anything was added recently about subagents", ago:"1 minute ago", msgs:8, cost:"211.5K", project:"cc-transcript-viewer" },
  { id:"s3", title:"[Image #3] I tried twice. Each time the command just silently exited", ago:"13 minutes ago", msgs:289, cost:"19.6M", project:"cc-transcript-viewer" },
  { id:"s4", title:"[Image #3] see my screen, those role labels should logically be displayed", ago:"5 hours ago", msgs:126, cost:"7.6M", project:"cc-transcript-viewer" },
  { id:"s5", title:"Can we in the fix show both token and weighted cost?", ago:"6 hours ago", msgs:280, cost:"21.2M", project:"cc-transcript-viewer" },
  { id:"s6", title:"cross-session-full-text-search", ago:"8 hours ago", msgs:2, cost:"0", project:"cc-transcript-viewer" },
  { id:"s7", title:"cross-session-full-text-search", ago:"8 hours ago", msgs:17, cost:"373.9K", project:"cc-transcript-viewer" },
  { id:"s8", title:"cross-session-full-text-search", ago:"8 hours ago", msgs:251, cost:"14.7M", project:"cc-transcript-viewer" },
  { id:"s9", title:"cross-session-full-text-search", ago:"9 hours ago", msgs:360, cost:"35.9M", project:"cc-transcript-viewer" },
  { id:"s10", title:"Not working. Do we have to re-build anything?", ago:"2 days ago", msgs:580, cost:"64.8M", project:"cc-transcript-viewer" },
  { id:"s11", title:"help me verify if the following blog claim is true: The author said", ago:"3 days ago", msgs:8, cost:"178.5K", project:"sandbox" },
  { id:"s12", title:"tried, still not working on screen, can you check the JSONL?", ago:"3 days ago", msgs:222, cost:"11.6M", project:"sandbox" },
  { id:"s13", title:"help me update `~/.claude/settings.json` as well", ago:"3 days ago", msgs:250, cost:"13.9M", project:"sandbox" },
  { id:"s14", title:"proceed", ago:"3 days ago", msgs:80, cost:"2.5M", project:"sandbox" },
  { id:"s15", title:"teach how to verify D-40.5", ago:"14 days ago", msgs:317, cost:"69.8M", project:"langfuse" },
  { id:"s16", title:"edit anyway", ago:"14 days ago", msgs:27, cost:"668K", project:"langfuse" },
];

// Active session header data
const ACTIVE = {
  title: "Help me mimic the /security-review skill/command to do a full review on https://github.com/carlosxl/cc-transcript-viewer",
  shortTitle: "Mimic /security-review on cc-transcript-viewer",
  project: "cc-transcript-viewer",
  path: "/Users/lxiang/sandbox/cc-transcript-viewer",
  started: "17:29:42",
  duration: "14m 56s",
  model: "claude-opus-4.7",
  metrics: { in: 90, out: "14.6k", cachePlus: "204.1k", cacheMinus: "4.6m", hit: "100%", units: "15.1m", toolCalls: 58 },
};

// Messages — represents the section visible in the original screenshot
// plus a couple more turns so the variations have something to scroll.
const MESSAGES = [
  { id:"m1", role:"user", at:"17:29:42", kind:"command", name:"/clear", message:"clear", args:"" },
  { id:"m2", role:"user", at:"17:30:36", kind:"command", name:"/security-review", message:"security-review",
    args:"this github repo, master branch: https://github.com/carlosxl/cc-transcript-viewer" },
  { id:"m3", role:"user", at:"17:30:36", kind:"stderr",
    text: "Error: Shell command failed for pattern \"!`git log --no-decorate origin/HEAD...`\": [stderr]\nfatal: ambiguous argument 'origin/HEAD...': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'" },
  { id:"m4", role:"user", at:"17:31:18", kind:"text",
    text: "Help me mimic the /security-review skill/command to do a full review on https://github.com/carlosxl/cc-transcript-viewer, master branch" },
  { id:"m5", role:"assistant", at:"17:31:59", model:"opus-4.7", parts:[
    { type:"think", text:"I need to understand what the /security-review skill does, then apply that same analysis to the cc-transcript-viewer repository on the master branch." },
    { type:"tool", tool:"Bash", args:{ command:"ls ~/.claude/commands/ 2>/dev/null; ls ~/.claude/skills/ 2>/dev/null", description:"Find security-review command/skill location" },
      result:"conclude-task.md\nlangfuse\nparallel-agent", tokens:124 },
    { type:"tool", tool:"Bash", args:{ command:"find ~/.claude -name \"*security-review*\" 2>/dev/null; find / -name \"security-review*\" -path \"*/commands/*\" 2>/dev/null | head -5", description:"Locate security-review command file" },
      result:"Command running in background with ID: b8uyza6u0. Output is being written to: /private/tmp/claude-501/-Users-l-xiang-sandbox-cc-transcript-viewer/dbb1e532-52da-4cf5-88a3-53239f227776/tasks/b8uyza6u0.output", tokens:212, async:true },
    { type:"tool", tool:"Read", args:{ file_path:"~/.claude/skills/security-review/SKILL.md" },
      result:"# Security Review\n\nFor any code under review, identify HIGH/MEDIUM/LOW severity issues.\nFocus on: input validation, auth boundaries, secret handling, injection vectors.\n\nOutput a Findings table grouped by severity.", tokens:184 },
  ]},
  { id:"m6", role:"assistant", at:"17:32:48", model:"opus-4.7", parts:[
    { type:"text", text:"I have the skill loaded. Now I'll clone the repository and walk the surface area." },
    { type:"tool", tool:"Bash", args:{ command:"git clone https://github.com/carlosxl/cc-transcript-viewer /tmp/ccrv && cd /tmp/ccrv && git log --oneline | head -5", description:"Clone target repo & check recent commits" },
      result:"Cloning into '/tmp/ccrv'...\nremote: Enumerating objects: 412, done.\nReceiving objects: 100% (412/412), 1.2 MiB | 8.1 MiB/s, done.\n\na9c4f12 token report: add cache-hit rate (#42)\n2b71e0a static: serve assets with content-hash\nc88de31 jsonl: tolerate trailing whitespace on schema rows\n11d04bb session list: virtualize > 200 rows\n0e72ba0 docs: getting started", tokens:340 },
  ]},
  { id:"m7", role:"user", at:"17:33:55", kind:"text",
    text:"Can you focus on the static asset serving in `static.ts`?" },
  { id:"m8", role:"assistant", at:"17:34:02", model:"opus-4.7", parts:[
    { type:"think", text:"User narrowed scope. I should diff the prefix-check logic and surface any path-traversal risk on the loopback-only server." },
    { type:"tool", tool:"Read", args:{ file_path:"src/static.ts", offset:100, limit:60 },
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
    { type:"text", text:"**LOW — `static.ts:122` prefix check without separator boundary.** The check `safe.startsWith(ROOT)` matches `/srv/app-evil` against root `/srv/app`. Bound to loopback so blast radius is limited, but worth tightening. Patch above appends the path separator before comparison." },
  ]},
];

// Token report rows
const TOKEN_REPORT = {
  duration: "14m 56s",
  toolCalls: { total: 58, main: 58, sub: 0 },
  cacheHit: "95.9%",
  totalUnits: "15.1m",
  rows: [
    { agent:"main", model:"opus-4.7", calls:"15/75×", input:{ raw:"93", weight:"1.4ku" }, c5:{ raw:"0", weight:"0u" }, c1h:{ raw:"207.3k", weight:"6.2mu" }, cRd:{ raw:"4.9m", weight:"7.4mu" }, out:{ raw:"19.6k", weight:"1.5mu" }, hit:"95.9%", units:"15.1m" },
  ],
  totals: { input:"1.4k", c5:"0", c1h:"6.2m", cRd:"7.4m", out:"1.5m", hit:"95.9%", units:"15.1m" },
};

Object.assign(window, { SESSIONS, ACTIVE, MESSAGES, TOKEN_REPORT });
