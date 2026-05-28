// Sample data — a long debugging session in a billing-service project,
// with one Agent subagent call. Realistic shapes; not exhaustive.

window.SAMPLE = (function () {
  // ---------- Sidebar: projects + sessions ----------
  const projects = [
    {
      id: 'billing-service',
      name: 'billing-service',
      path: '~/code/billing-service',
      sessions: [
        {
          id: 's-billing-1',
          title: 'Debug webhook 500s on Stripe payouts',
          time: '17m ago',
          messages: 248,
          cost: 4.82,
          tokens: { in: 184320, out: 12480, cc: 92160, cr: 421390 },
          pinned: true,
          active: true,
        },
        {
          id: 's-billing-2',
          title: 'Refactor invoice ledger query path',
          time: '2h ago',
          messages: 142,
          cost: 2.18,
          tokens: { in: 92100, out: 6900, cc: 40100, cr: 220900 },
        },
        {
          id: 's-billing-3',
          title: 'Migrate fee schedule to v3 pricing table',
          time: 'yesterday',
          messages: 96,
          cost: 1.40,
          tokens: { in: 60100, out: 4900, cc: 28100, cr: 140900 },
        },
      ],
    },
    {
      id: 'web-app',
      name: 'web-app',
      path: '~/code/web-app',
      sessions: [
        {
          id: 's-web-1',
          title: 'Wire up new pricing page A/B test',
          time: 'just now',
          messages: 31,
          cost: 0.42,
          tokens: { in: 18100, out: 1200, cc: 8400, cr: 41000 },
          live: true,
        },
        {
          id: 's-web-2',
          title: 'Fix mobile nav focus trap on iOS',
          time: '4h ago',
          messages: 88,
          cost: 1.06,
          tokens: { in: 42100, out: 3200, cc: 18400, cr: 96000 },
          pinned: true,
        },
      ],
    },
    {
      id: 'infra-scripts',
      name: 'infra-scripts',
      path: '~/code/infra-scripts',
      sessions: [
        {
          id: 's-infra-1',
          title: 'Audit IAM policies for prod read access',
          time: '1d ago',
          messages: 64,
          cost: 0.91,
          tokens: { in: 36100, out: 2800, cc: 14400, cr: 78000 },
        },
        {
          id: 's-infra-2',
          title: 'Add cloudwatch alarms for stale queues',
          time: '3d ago',
          messages: 24,
          cost: 0.18,
          tokens: { in: 9100, out: 800, cc: 3400, cr: 18000 },
        },
      ],
    },
    {
      id: 'claude-config',
      name: 'claude-config',
      path: '~/.claude',
      sessions: [
        {
          id: 's-cfg-1',
          title: 'Author project CLAUDE.md',
          time: '5d ago',
          messages: 12,
          cost: 0.06,
          tokens: { in: 2100, out: 1800, cc: 800, cr: 4000 },
        },
      ],
    },
  ];

  // ---------- Active session: long debugging transcript ----------
  // Build ~14 turns mixing user prompts, attachments, assistant requests with
  // thinking / text / tool_use / tool_result / diffs, and ONE subagent call.

  let messageCounter = 0;
  const m = () => `m${(++messageCounter).toString().padStart(4, '0')}`;

  // helpers
  const T = (id, time, prompt, requests, opts = {}) => ({
    id, // T1..Tn
    time,
    prompt,
    attachments: opts.attachments || [],
    requests,
    userMsgId: m(),
  });
  const R = (blocks, opts = {}) => ({
    id: m(),
    blocks,
    ttft: opts.ttft || 412,
    duration: opts.duration || 1840,
    cost: opts.cost || 0.18,
    tokens: opts.tokens || { in: 4200, out: 280, cc: 1800, cr: 8200 },
  });
  const txt = (s) => ({ kind: 'text', body: s });
  const think = (s) => ({ kind: 'thinking', body: s });
  const tool = (name, input, output, opts = {}) => ({
    kind: 'tool_use',
    name,
    input,
    output,
    status: opts.status || 'ok',
    duration: opts.duration || 240,
    preview: opts.preview,
    isSubagent: opts.isSubagent || false,
    subagentRef: opts.subagentRef,
  });
  const diff = (path, lang, adds, dels, hunks) => ({
    kind: 'diff', path, lang, adds, dels, hunks,
  });

  const turns = [];

  // ---- Turn 1
  turns.push(T('T1', '14:02:11',
    'Stripe webhook handler is intermittently 500-ing on payout.created events for ~5% of merchants. Logs show a `pg: deadlock detected` once an hour. Can you take a look?',
    [
      R([
        think('User says intermittent 500s, deadlock once an hour. Two questions to disambiguate: which handler (the new v3 or legacy?), and is the deadlock from the same write path. I should start by locating the webhook handler and the recent error log entries before guessing.'),
        txt("I'll start by locating the webhook handler and recent error logs. Looking at the project structure first."),
        tool('Bash', { command: 'ls src/webhooks' },
          'payout.ts\npayout.test.ts\ndispute.ts\ninvoice.ts\nindex.ts',
          { preview: 'payout.ts\npayout.test.ts\ndispute.ts\ninvoice.ts\nindex.ts', duration: 142 }),
        tool('Read', { path: 'src/webhooks/payout.ts' },
          '...442 lines...',
          { preview: 'import { db } from "../db";\nimport { logger } from "../log";\n\nexport async function handlePayoutCreated(evt: Stripe.Event) {\n  const payout = evt.data.object as Stripe.Payout;\n  const merchant = await db.query("SELECT * FROM merchants WHERE stripe_id = $1 FOR UPDATE", [payout.account]);\n  // ... 430 more lines\n}', duration: 320 }),
      ], { cost: 0.31, duration: 2210, ttft: 380, tokens: { in: 9100, out: 420, cc: 3200, cr: 12100 } }),
    ],
    { attachments: [
      { kind: 'skills', desc: 'Active skills: read_pdf, frontend-design', tokens: 380, ts: '14:02:11' },
      { kind: 'mcp', desc: 'MCP tool delta: linear added (12 tools)', tokens: 1820, ts: '14:02:11' },
      { kind: 'mode', desc: 'Mode flags: explainMode=false, autoApprove=false', tokens: 64, ts: '14:02:11' },
    ] },
  ));

  // ---- Turn 2
  turns.push(T('T2', '14:03:48',
    'Skip reading the whole file. Just grep for `FOR UPDATE` in the webhooks dir.',
    [
      R([
        think('Right — user wants focused grep, not a full read.'),
        tool('Grep', { pattern: 'FOR UPDATE', path: 'src/webhooks' },
          'src/webhooks/payout.ts:18: SELECT * FROM merchants WHERE stripe_id = $1 FOR UPDATE\nsrc/webhooks/payout.ts:91: SELECT id FROM payouts WHERE id = $1 FOR UPDATE\nsrc/webhooks/dispute.ts:54: SELECT * FROM disputes WHERE evidence_id = $1 FOR UPDATE NOWAIT\nsrc/webhooks/invoice.ts:120: SELECT * FROM invoices WHERE merchant_id = $1 FOR UPDATE',
          { preview: 'src/webhooks/payout.ts:18: SELECT * FROM merchants WHERE stripe_id = $1 FOR UPDATE\nsrc/webhooks/payout.ts:91: SELECT id FROM payouts WHERE id = $1 FOR UPDATE\nsrc/webhooks/dispute.ts:54: SELECT * FROM disputes WHERE evidence_id = $1 FOR UPDATE NOWAIT\nsrc/webhooks/invoice.ts:120: SELECT * FROM invoices WHERE merchant_id = $1 FOR UPDATE', duration: 92 }),
        txt('Four `FOR UPDATE` sites across three files. The payout handler grabs two row-locks in sequence (`merchants` then `payouts`). That ordering is the most likely deadlock culprit if another path grabs them in reverse. Want me to look at how the rest of the codebase orders these two locks?'),
      ], { cost: 0.21, duration: 1320, tokens: { in: 5100, out: 240, cc: 2400, cr: 9800 } }),
    ],
  ));

  // ---- Turn 3
  turns.push(T('T3', '14:04:22',
    'Yes — search the whole codebase for any path that locks `payouts` before `merchants`.',
    [
      R([
        tool('Grep', { pattern: 'payouts.*FOR UPDATE', path: 'src' },
          'src/webhooks/payout.ts:91: SELECT id FROM payouts WHERE id = $1 FOR UPDATE\nsrc/jobs/reconcile.ts:204: SELECT * FROM payouts WHERE status = \'pending\' FOR UPDATE SKIP LOCKED\nsrc/jobs/reconcile.ts:218: SELECT * FROM merchants WHERE id = $1 FOR UPDATE',
          { preview: 'src/webhooks/payout.ts:91: SELECT id FROM payouts WHERE id = $1 FOR UPDATE\nsrc/jobs/reconcile.ts:204: SELECT * FROM payouts WHERE status = \'pending\' FOR UPDATE SKIP LOCKED\nsrc/jobs/reconcile.ts:218: SELECT * FROM merchants WHERE id = $1 FOR UPDATE', duration: 84 }),
        txt('Found it. `src/jobs/reconcile.ts` locks `payouts` first then `merchants`, the **reverse** of the webhook order. That cron runs every 5 minutes — explains the "once an hour" pattern (concurrency depends on payout volume).'),
        tool('Read', { path: 'src/jobs/reconcile.ts', offset: 198, limit: 40 },
          '...40 lines around the locking code...',
          { preview: '198 async function reconcileBatch() {\n199   const tx = await db.tx();\n200   try {\n201     // Phase 1: claim pending payouts\n202     const pending = await tx.query(\n203       `SELECT * FROM payouts\n204        WHERE status = \'pending\' FOR UPDATE SKIP LOCKED\n205        LIMIT 50`\n206     );\n207     for (const p of pending) {\n208       // Phase 2: lock merchant for invariant check\n209       const merchant = await tx.query(\n210         `SELECT * FROM merchants\n211          WHERE id = $1 FOR UPDATE`,\n212         [p.merchant_id]\n213       );\n... ', duration: 130 }),
        txt('Confirmed — reconcile job grabs `payouts` (line 204) then `merchants` (line 218) inside a single transaction. Webhook grabs `merchants` (line 18) then `payouts` (line 91). Classic AB/BA deadlock.\n\nThe usual fix is to make all paths lock in the same order. Webhook depends on merchant lookup first to validate the account, so flipping the webhook order means an extra round-trip. Flipping the reconcile job is cleaner — `merchants` first, then `payouts`. Want me to apply that?'),
      ], { cost: 0.39, duration: 2840, tokens: { in: 11200, out: 580, cc: 4200, cr: 14100 } }),
    ],
  ));

  // ---- Turn 4
  turns.push(T('T4', '14:05:10',
    'Go ahead. Also add a comment explaining why the order matters.',
    [
      R([
        tool('Edit', { path: 'src/jobs/reconcile.ts' }, 'OK — applied edit', { duration: 180 }),
        diff('src/jobs/reconcile.ts', 'ts', 8, 3, [
          { type: 'hunk', text: '@@ -198,18 +198,23 @@ async function reconcileBatch()' },
          { type: 'ctx', n: 198, text: 'async function reconcileBatch() {' },
          { type: 'ctx', n: 199, text: '  const tx = await db.tx();' },
          { type: 'ctx', n: 200, text: '  try {' },
          { type: 'del', n: 201, text: '    // Phase 1: claim pending payouts' },
          { type: 'del', n: 202, text: '    const pending = await tx.query(' },
          { type: 'del', n: 203, text: '      `SELECT * FROM payouts' },
          { type: 'add', n: 201, text: '    // LOCK ORDER: merchants → payouts.' },
          { type: 'add', n: 202, text: '    // Webhook handlePayoutCreated takes merchants first, then payouts.' },
          { type: 'add', n: 203, text: '    // Any other path that touches both MUST follow the same order' },
          { type: 'add', n: 204, text: '    // or we deadlock under concurrent load (Linear ENG-4421).' },
          { type: 'add', n: 205, text: '    const candidates = await tx.query(' },
          { type: 'add', n: 206, text: '      `SELECT id, merchant_id FROM payouts' },
          { type: 'ctx', n: 207, text: '       WHERE status = \'pending\'' },
          { type: 'ctx', n: 208, text: '       LIMIT 50`' },
          { type: 'ctx', n: 209, text: '    );' },
          { type: 'add', n: 210, text: '    // 1. Lock merchants up-front, in id-order, to satisfy global ordering.' },
          { type: 'add', n: 211, text: '    const merchantIds = [...new Set(candidates.map(c => c.merchant_id))].sort();' },
          { type: 'add', n: 212, text: '    await tx.query(`SELECT id FROM merchants WHERE id = ANY($1) FOR UPDATE`, [merchantIds]);' },
        ]),
        txt('Done. I split the query so we claim candidate IDs first (lock-free), then take `merchants FOR UPDATE` in id-sorted order, then `payouts FOR UPDATE` inside the loop. Order is now consistent with the webhook path everywhere.'),
      ], { cost: 0.42, duration: 3120, tokens: { in: 13100, out: 720, cc: 5400, cr: 16100 } }),
    ],
  ));

  // ---- Turn 5
  turns.push(T('T5', '14:06:54',
    'Run the test suite for the webhooks and the reconciler.',
    [
      R([
        tool('Bash', { command: 'npm test -- src/webhooks src/jobs/reconcile' },
          'PASS src/webhooks/payout.test.ts\nFAIL src/jobs/reconcile.test.ts\n  ● reconcileBatch › claims up to 50 pending payouts\n    expect(received).toHaveLength(expected)\n    Expected length: 50\n    Received length: 0\n      at line 88\n\nTest Suites: 1 failed, 1 passed, 2 total\nTests:       1 failed, 18 passed, 19 total',
          { status: 'err', preview: 'PASS src/webhooks/payout.test.ts\nFAIL src/jobs/reconcile.test.ts\n  ● reconcileBatch › claims up to 50 pending payouts\n    expect(received).toHaveLength(expected)\n    Expected length: 50\n    Received length: 0\n      at line 88', duration: 4280 }),
        think('Test fails because the new query returns rows shaped { id, merchant_id } instead of full payout records. The test assertion checks `length` so the count should be 50, but the surrounding code probably needs the full record now.'),
        tool('Read', { path: 'src/jobs/reconcile.test.ts', offset: 80, limit: 20 },
          '...test snippet...',
          { preview: '80 it(\'claims up to 50 pending payouts\', async () => {\n81   await seedPayouts({ count: 80, status: \'pending\' });\n82   const claimed = await reconcileBatch();\n83   expect(claimed).toHaveLength(50);\n84 });', duration: 110 }),
        txt('The test expects `reconcileBatch()` to return the claimed rows. My change made it return `void`. Two-line fix to return the result, plus update the result shape to match what the test inspects.'),
      ], { cost: 0.36, duration: 6920, ttft: 510, tokens: { in: 12100, out: 640, cc: 4900, cr: 14900 } }),
    ],
  ));

  // ---- Turn 6
  turns.push(T('T6', '14:08:21',
    'Fix it.',
    [
      R([
        tool('Edit', { path: 'src/jobs/reconcile.ts' }, 'OK', { duration: 160 }),
        diff('src/jobs/reconcile.ts', 'ts', 4, 1, [
          { type: 'hunk', text: '@@ -228,10 +228,13 @@ async function reconcileBatch()' },
          { type: 'ctx', n: 228, text: '      await markReconciled(tx, p.id);' },
          { type: 'ctx', n: 229, text: '    }' },
          { type: 'del', n: 230, text: '    await tx.commit();' },
          { type: 'add', n: 230, text: '    const claimed = candidates.map(c => ({ id: c.id, merchantId: c.merchant_id }));' },
          { type: 'add', n: 231, text: '    await tx.commit();' },
          { type: 'add', n: 232, text: '    return claimed;' },
          { type: 'add', n: 233, text: '  } catch (e) {' },
        ]),
        tool('Bash', { command: 'npm test -- src/jobs/reconcile.test.ts' },
          'PASS src/jobs/reconcile.test.ts\n  reconcileBatch\n    ✓ claims up to 50 pending payouts (118 ms)\n    ✓ skips already-locked rows (94 ms)\n    ✓ commits in a single transaction (102 ms)\n\nTest Suites: 1 passed, 1 total\nTests:       19 passed, 19 total',
          { preview: 'PASS src/jobs/reconcile.test.ts\n  reconcileBatch\n    ✓ claims up to 50 pending payouts (118 ms)\n    ✓ skips already-locked rows (94 ms)\n    ✓ commits in a single transaction (102 ms)', duration: 3920 }),
        txt('Green across the board.'),
      ], { cost: 0.33, duration: 5320, tokens: { in: 11800, out: 580, cc: 4800, cr: 13800 } }),
    ],
  ));

  // ---- Turn 7 — user mentions retries with attachment
  turns.push(T('T7', '14:11:02',
    'Good. Now — the handler also needs an idempotency guard. Stripe will retry on 5xx, and right now a deadlock-retry can double-insert a ledger entry. Add one.',
    [
      R([
        think('User wants idempotency on the webhook handler. Stripe webhook events carry an `id` per delivery. The conventional approach is a unique-constrained `webhook_events` table the handler writes to inside the same transaction; if the insert fails on unique violation we short-circuit.'),
        txt('Approach: add a `webhook_events(event_id PRIMARY KEY, kind, received_at)` table; the handler inserts a row inside the same transaction it does the ledger write. On unique-violation we treat the request as already-handled and return 200 immediately.\n\nI\'ll need to (1) write a migration, (2) wire the check into the handler, (3) add a test that simulates a Stripe retry.'),
        tool('Glob', { pattern: 'migrations/**/*.sql' },
          'migrations/001_init.sql\nmigrations/002_merchants.sql\nmigrations/003_payouts.sql\nmigrations/004_ledger.sql\nmigrations/005_fee_schedule.sql',
          { preview: 'migrations/001_init.sql\nmigrations/002_merchants.sql\nmigrations/003_payouts.sql\nmigrations/004_ledger.sql\nmigrations/005_fee_schedule.sql', duration: 76 }),
        tool('Write', { path: 'migrations/006_webhook_events.sql' },
          'OK — created file',
          { duration: 90 }),
        diff('migrations/006_webhook_events.sql', 'sql', 9, 0, [
          { type: 'hunk', text: '@@ -0,0 +1,9 @@' },
          { type: 'add', n: 1, text: '-- 006_webhook_events.sql' },
          { type: 'add', n: 2, text: '-- Idempotency guard for Stripe webhook delivery retries.' },
          { type: 'add', n: 3, text: 'CREATE TABLE webhook_events (' },
          { type: 'add', n: 4, text: '  event_id    TEXT PRIMARY KEY,' },
          { type: 'add', n: 5, text: '  kind        TEXT NOT NULL,' },
          { type: 'add', n: 6, text: '  received_at TIMESTAMPTZ NOT NULL DEFAULT now()' },
          { type: 'add', n: 7, text: ');' },
          { type: 'add', n: 8, text: 'CREATE INDEX webhook_events_received_at_idx' },
          { type: 'add', n: 9, text: '  ON webhook_events (received_at DESC);' },
        ]),
      ], { cost: 0.41, duration: 4020, ttft: 420, tokens: { in: 13800, out: 760, cc: 5200, cr: 16800 } }),
      R([
        tool('Edit', { path: 'src/webhooks/payout.ts' }, 'OK', { duration: 200 }),
        diff('src/webhooks/payout.ts', 'ts', 11, 2, [
          { type: 'hunk', text: '@@ -10,15 +10,24 @@ export async function handlePayoutCreated(evt: Stripe.Event) {' },
          { type: 'ctx', n: 10, text: 'export async function handlePayoutCreated(evt: Stripe.Event) {' },
          { type: 'ctx', n: 11, text: '  const payout = evt.data.object as Stripe.Payout;' },
          { type: 'del', n: 12, text: '  const tx = await db.tx();' },
          { type: 'del', n: 13, text: '  try {' },
          { type: 'add', n: 12, text: '  const tx = await db.tx();' },
          { type: 'add', n: 13, text: '  try {' },
          { type: 'add', n: 14, text: '    // Idempotency: short-circuit if Stripe is retrying a delivery we' },
          { type: 'add', n: 15, text: '    // already processed (see migrations/006_webhook_events.sql).' },
          { type: 'add', n: 16, text: '    try {' },
          { type: 'add', n: 17, text: '      await tx.query(' },
          { type: 'add', n: 18, text: '        `INSERT INTO webhook_events (event_id, kind) VALUES ($1, $2)`,' },
          { type: 'add', n: 19, text: '        [evt.id, evt.type]' },
          { type: 'add', n: 20, text: '      );' },
          { type: 'add', n: 21, text: '    } catch (e: any) {' },
          { type: 'add', n: 22, text: '      if (e.code === \'23505\') { await tx.rollback(); return { handled: true, duplicate: true }; }' },
          { type: 'add', n: 23, text: '      throw e;' },
          { type: 'add', n: 24, text: '    }' },
          { type: 'ctx', n: 25, text: '    const merchant = await tx.query(' },
        ]),
        txt('Migration + handler change in place. Want me to also write the retry-simulation test?'),
      ], { cost: 0.29, duration: 2810, tokens: { in: 9100, out: 520, cc: 3900, cr: 11200 } }),
    ],
  ));

  // ---- Turn 8
  turns.push(T('T8', '14:14:40',
    'Yes, write the test.',
    [
      R([
        tool('Edit', { path: 'src/webhooks/payout.test.ts' }, 'OK', { duration: 220 }),
        diff('src/webhooks/payout.test.ts', 'ts', 14, 0, [
          { type: 'hunk', text: '@@ -88,6 +88,20 @@ describe(\'handlePayoutCreated\', () =>' },
          { type: 'add', n: 89, text: '  it(\'short-circuits on Stripe retry of the same event\', async () => {' },
          { type: 'add', n: 90, text: '    const evt = makeStripeEvent({ id: \'evt_test_retry_1\' });' },
          { type: 'add', n: 91, text: '    // First delivery — normal processing.' },
          { type: 'add', n: 92, text: '    const first = await handlePayoutCreated(evt);' },
          { type: 'add', n: 93, text: '    expect(first).toEqual({ handled: true, duplicate: false });' },
          { type: 'add', n: 94, text: '    // Stripe retries — should be idempotent.' },
          { type: 'add', n: 95, text: '    const second = await handlePayoutCreated(evt);' },
          { type: 'add', n: 96, text: '    expect(second).toEqual({ handled: true, duplicate: true });' },
          { type: 'add', n: 97, text: '    // Ledger entry must exist exactly once.' },
          { type: 'add', n: 98, text: '    const ledger = await db.query(' },
          { type: 'add', n: 99, text: '      `SELECT count(*)::int AS n FROM ledger_entries WHERE source_event_id = $1`,' },
          { type: 'add', n: 100, text: '      [evt.id]' },
          { type: 'add', n: 101, text: '    );' },
          { type: 'add', n: 102, text: '    expect(ledger[0].n).toBe(1);' },
        ]),
        tool('Bash', { command: 'npm test -- src/webhooks/payout.test.ts' },
          'PASS src/webhooks/payout.test.ts\n  handlePayoutCreated\n    ✓ writes a ledger entry on first delivery (140 ms)\n    ✓ short-circuits on Stripe retry of the same event (98 ms)\n    ✓ rolls back on merchant lookup failure (76 ms)\n\nTest Suites: 1 passed, 1 total\nTests:       11 passed, 11 total',
          { preview: 'PASS src/webhooks/payout.test.ts\n  handlePayoutCreated\n    ✓ writes a ledger entry on first delivery (140 ms)\n    ✓ short-circuits on Stripe retry of the same event (98 ms)\n    ✓ rolls back on merchant lookup failure (76 ms)', duration: 3120 }),
      ], { cost: 0.38, duration: 4040, tokens: { in: 12800, out: 720, cc: 5100, cr: 15400 } }),
    ],
  ));

  // ---- Turn 9 — subagent call!
  turns.push(T('T9', '14:18:11',
    'Before we close this out — can you sweep the rest of the webhook handlers for the same idempotency gap and report back? Spawn a subagent if it makes the audit cleaner.',
    [
      R([
        think('A subagent is appropriate: the audit will touch many files and produce a focused report. The main session stays focused on payouts. I\'ll spawn one with a tight scope.'),
        txt('Spawning a focused audit subagent for the other handlers. I\'ll surface its findings here.'),
        tool('Agent', {
          subagent_type: 'general-purpose',
          description: 'audit webhook idempotency',
          prompt: 'You are auditing src/webhooks/ for missing idempotency guards on Stripe webhook handlers. For each handler that is NOT payout.ts, check whether it (1) writes to webhook_events, (2) handles unique-violation, (3) returns a duplicate flag. Produce a markdown report with file:line citations and a recommended one-line fix for each gap. Do not modify files.',
        },
          'Subagent completed in 4 turns. Final report:\n\n# Webhook idempotency audit\n\n**Audited:** dispute.ts, invoice.ts, subscription.ts (payout.ts excluded — already fixed).\n\n## Findings\n\n- `src/webhooks/dispute.ts` — **MISSING.** No webhook_events insert; relies on `dispute_id` uniqueness, which Stripe reuses on evidence updates. → insert into webhook_events before line 22.\n- `src/webhooks/invoice.ts` — **MISSING.** Same shape. → insert before line 14.\n- `src/webhooks/subscription.ts` — **PRESENT** (lines 30–38), well-formed.',
          {
            isSubagent: true,
            subagentRef: 'subagent-1',
            duration: 184000,
            preview: 'Subagent completed in 4 turns. Final report:\n\n# Webhook idempotency audit\n\n**Audited:** dispute.ts, invoice.ts, subscription.ts (payout.ts excluded — already fixed).\n\n## Findings\n\n- src/webhooks/dispute.ts — MISSING. No webhook_events insert; relies on dispute_id uniqueness, which Stripe reuses on evidence updates. → insert into webhook_events before line 22.\n- src/webhooks/invoice.ts — MISSING. Same shape. → insert before line 14.\n- src/webhooks/subscription.ts — PRESENT (lines 30–38), well-formed.',
          }),
        txt('Subagent finished. Two more handlers missing the guard (`dispute.ts`, `invoice.ts`). Want me to apply the same fix pattern to both, or do you want to review the audit first?'),
      ], { cost: 0.94, duration: 188100, ttft: 360, tokens: { in: 28100, out: 1840, cc: 12100, cr: 41200 } }),
    ],
  ));

  // ---- Turn 10
  turns.push(T('T10', '14:23:51',
    'Apply the fix to both. Same pattern.',
    [
      R([
        tool('Edit', { path: 'src/webhooks/dispute.ts' }, 'OK', { duration: 200 }),
        diff('src/webhooks/dispute.ts', 'ts', 12, 2, [
          { type: 'hunk', text: '@@ -18,8 +18,18 @@ export async function handleDispute(evt: Stripe.Event) {' },
          { type: 'ctx', n: 18, text: '  const dispute = evt.data.object as Stripe.Dispute;' },
          { type: 'del', n: 19, text: '  const tx = await db.tx();' },
          { type: 'del', n: 20, text: '  try {' },
          { type: 'add', n: 19, text: '  const tx = await db.tx();' },
          { type: 'add', n: 20, text: '  try {' },
          { type: 'add', n: 21, text: '    try {' },
          { type: 'add', n: 22, text: '      await tx.query(' },
          { type: 'add', n: 23, text: '        `INSERT INTO webhook_events (event_id, kind) VALUES ($1, $2)`,' },
          { type: 'add', n: 24, text: '        [evt.id, evt.type]' },
          { type: 'add', n: 25, text: '      );' },
          { type: 'add', n: 26, text: '    } catch (e: any) {' },
          { type: 'add', n: 27, text: '      if (e.code === \'23505\') { await tx.rollback(); return { handled: true, duplicate: true }; }' },
          { type: 'add', n: 28, text: '      throw e;' },
          { type: 'add', n: 29, text: '    }' },
        ]),
        tool('Edit', { path: 'src/webhooks/invoice.ts' }, 'OK', { duration: 190 }),
        diff('src/webhooks/invoice.ts', 'ts', 12, 2, [
          { type: 'hunk', text: '@@ -10,8 +10,18 @@ export async function handleInvoice(evt: Stripe.Event) {' },
          { type: 'ctx', n: 10, text: '  const invoice = evt.data.object as Stripe.Invoice;' },
          { type: 'del', n: 11, text: '  const tx = await db.tx();' },
          { type: 'del', n: 12, text: '  try {' },
          { type: 'add', n: 11, text: '  const tx = await db.tx();' },
          { type: 'add', n: 12, text: '  try {' },
          { type: 'add', n: 13, text: '    try {' },
          { type: 'add', n: 14, text: '      await tx.query(' },
          { type: 'add', n: 15, text: '        `INSERT INTO webhook_events (event_id, kind) VALUES ($1, $2)`,' },
          { type: 'add', n: 16, text: '        [evt.id, evt.type]' },
          { type: 'add', n: 17, text: '      );' },
          { type: 'add', n: 18, text: '    } catch (e: any) {' },
          { type: 'add', n: 19, text: '      if (e.code === \'23505\') { await tx.rollback(); return { handled: true, duplicate: true }; }' },
          { type: 'add', n: 20, text: '      throw e;' },
          { type: 'add', n: 21, text: '    }' },
        ]),
        tool('Bash', { command: 'npm test -- src/webhooks' },
          'PASS src/webhooks/payout.test.ts\nPASS src/webhooks/dispute.test.ts\nPASS src/webhooks/invoice.test.ts\nPASS src/webhooks/subscription.test.ts\n\nTest Suites: 4 passed, 4 total\nTests:       42 passed, 42 total\nTime:        6.81 s',
          { preview: 'PASS src/webhooks/payout.test.ts\nPASS src/webhooks/dispute.test.ts\nPASS src/webhooks/invoice.test.ts\nPASS src/webhooks/subscription.test.ts\n\nTest Suites: 4 passed, 4 total\nTests:       42 passed, 42 total\nTime:        6.81 s', duration: 6810 }),
        txt('All four handlers green; 42 tests pass. The deadlock fix and idempotency guards are in.'),
      ], { cost: 0.51, duration: 8920, tokens: { in: 18100, out: 920, cc: 7400, cr: 22800 } }),
    ],
  ));

  // ---- Turn 11 (stderr envelope — non-prompt user message)
  turns.push(T('T11', '14:24:30',
    '[stderr] npm WARN deprecated har-validator@5.1.5: this library is no longer supported',
    [
      R([
        txt('Noted — that warning is from a transitive dep of `request`, which the test setup pulls in. Safe to ignore for this PR; worth tracking separately if you want to evict `request` entirely.'),
      ], { cost: 0.04, duration: 620, tokens: { in: 1100, out: 80, cc: 400, cr: 1900 } }),
    ],
  ));

  // ---- Turn 12 — final summary request
  turns.push(T('T12', '14:25:18',
    'Give me a one-paragraph summary of what changed and any follow-ups.',
    [
      R([
        txt('**Changed:** `src/jobs/reconcile.ts` now locks `merchants` before `payouts`, matching the webhook order and eliminating the AB/BA deadlock. All four webhook handlers (`payout`, `dispute`, `invoice`, `subscription`) now write to a new `webhook_events` table inside the request transaction and short-circuit on unique-violation, making them idempotent under Stripe retries. Migration `006_webhook_events.sql` adds the table.\n\n**Follow-ups:** (1) Backfill is not needed — the table only matters for events going forward. (2) Consider adding a Datadog monitor on `webhook_events.received_at` to catch silent delivery drops. (3) The `request` transitive-dep warning surfaced during tests is worth its own ticket.'),
      ], { cost: 0.13, duration: 1840, tokens: { in: 4100, out: 380, cc: 1800, cr: 5200 } }),
    ],
  ));

  // ---- (Hidden until live-tail fires)
  const livePending = T('T13', '14:30:02',
    'Actually one more — can you check if there are any other AB/BA lock orderings in the codebase?',
    [
      R([
        tool('Grep', { pattern: 'FOR UPDATE', path: 'src', count: true },
          '17 matches across 9 files', { preview: '17 matches across 9 files', duration: 110 }),
        txt('17 sites across 9 files. I\'ll build a quick dependency graph of which tables each transaction locks in what order, and flag any inverted pairs…'),
      ], { cost: 0.18, duration: 2210, tokens: { in: 5200, out: 320, cc: 2100, cr: 8800 } }),
    ],
  );

  // ---- The subagent's own internal transcript ----
  let saCounter = 0;
  const sm = () => `sm${(++saCounter).toString().padStart(4, '0')}`;
  const sR = (blocks, opts = {}) => ({
    id: sm(),
    blocks,
    ttft: opts.ttft || 420,
    duration: opts.duration || 1820,
    cost: opts.cost || 0.12,
    tokens: opts.tokens || { in: 3100, out: 220, cc: 1400, cr: 5800 },
  });

  const subagentSession = {
    id: 'subagent-1',
    title: 'audit webhook idempotency',
    parentSessionId: 's-billing-1',
    parentTurnId: 'T9',
    model: 'claude-haiku-4-5',
    isSubagent: true,
    turns: [
      {
        id: 'T1', time: '14:18:11',
        prompt: 'You are auditing src/webhooks/ for missing idempotency guards on Stripe webhook handlers. For each handler that is NOT payout.ts, check whether it (1) writes to webhook_events, (2) handles unique-violation, (3) returns a duplicate flag. Produce a markdown report with file:line citations and a recommended one-line fix for each gap. Do not modify files.',
        attachments: [],
        userMsgId: sm(),
        requests: [
          sR([
            txt('Auditing webhook handlers under `src/webhooks/`. Starting with a directory listing.'),
            tool('Bash', { command: 'ls src/webhooks' },
              'payout.ts\npayout.test.ts\ndispute.ts\ndispute.test.ts\ninvoice.ts\ninvoice.test.ts\nsubscription.ts\nsubscription.test.ts\nindex.ts',
              { preview: 'payout.ts\ndispute.ts\ninvoice.ts\nsubscription.ts\nindex.ts', duration: 92 }),
            txt('Three handlers in scope: dispute.ts, invoice.ts, subscription.ts.'),
          ], { cost: 0.16, duration: 1810 }),
        ],
      },
      {
        id: 'T2', time: '14:18:48',
        prompt: '(continue)',
        attachments: [],
        userMsgId: sm(),
        requests: [
          sR([
            tool('Read', { path: 'src/webhooks/dispute.ts' },
              '...', { preview: 'export async function handleDispute(evt: Stripe.Event) {\n  const dispute = evt.data.object as Stripe.Dispute;\n  const tx = await db.tx();\n  try {\n    // ...no webhook_events insert here...\n    const merchant = await tx.query(...);' , duration: 180 }),
            txt('No `webhook_events` insert in dispute.ts. Relies on `dispute_id` uniqueness — but Stripe reuses dispute IDs across evidence-update deliveries, so retries can double-process.'),
          ], { cost: 0.14, duration: 1620 }),
        ],
      },
      {
        id: 'T3', time: '14:19:32',
        prompt: '(continue)',
        attachments: [],
        userMsgId: sm(),
        requests: [
          sR([
            tool('Read', { path: 'src/webhooks/invoice.ts' },
              '...', { preview: 'export async function handleInvoice(evt: Stripe.Event) {\n  const invoice = evt.data.object as Stripe.Invoice;\n  const tx = await db.tx();\n  // ...no idempotency...', duration: 170 }),
            tool('Read', { path: 'src/webhooks/subscription.ts' },
              '...', { preview: 'export async function handleSubscription(evt: Stripe.Event) {\n  const sub = evt.data.object as Stripe.Subscription;\n  const tx = await db.tx();\n  try {\n    await tx.query(`INSERT INTO webhook_events ...`);\n    // ...handles 23505...', duration: 190 }),
            txt('`subscription.ts` already has the guard. `invoice.ts` is missing it.'),
          ], { cost: 0.18, duration: 2040 }),
        ],
      },
      {
        id: 'T4', time: '14:20:51',
        prompt: 'Produce the final report.',
        attachments: [],
        userMsgId: sm(),
        requests: [
          sR([
            txt('# Webhook idempotency audit\n\n**Audited:** `dispute.ts`, `invoice.ts`, `subscription.ts` (`payout.ts` excluded — already fixed).\n\n## Findings\n\n- **`src/webhooks/dispute.ts`** — MISSING. No `webhook_events` insert; relies on `dispute_id` uniqueness, which Stripe reuses on evidence updates.\n  → Insert into `webhook_events` before line 22.\n- **`src/webhooks/invoice.ts`** — MISSING. Same shape.\n  → Insert before line 14.\n- **`src/webhooks/subscription.ts`** — PRESENT (lines 30–38), well-formed.\n\n## Recommended one-line fix\n\nWrap the existing `tx.query` calls in `src/webhooks/dispute.ts` and `invoice.ts` with the same try/catch pattern used in `payout.ts` (insert into `webhook_events`, treat 23505 as a duplicate, return early).'),
          ], { cost: 0.21, duration: 2640 }),
        ],
      },
    ],
  };

  const activeSession = {
    id: 's-billing-1',
    title: 'Debug webhook 500s on Stripe payouts',
    model: 'claude-sonnet-4-5',
    project: 'billing-service',
    projectPath: '~/code/billing-service',
    startedAt: '14:02:11',
    turns,
    livePending,
    subagents: { 'subagent-1': subagentSession },
  };

  // ---- Sample search results ----
  const searchResults = [
    {
      sessionId: 's-billing-1', sessionTitle: 'Debug webhook 500s on Stripe payouts',
      project: 'billing-service', time: '17m ago',
      badge: 'tool_use',
      snippet: 'Grep("<mark>FOR UPDATE</mark>", path="src/webhooks")  →  4 results',
      target: 'T2',
    },
    {
      sessionId: 's-billing-1', sessionTitle: 'Debug webhook 500s on Stripe payouts',
      project: 'billing-service', time: '17m ago',
      badge: 'diff',
      snippet: 'src/jobs/reconcile.ts  // LOCK ORDER: merchants → payouts. <mark>FOR UPDATE</mark>...',
      target: 'T4',
    },
    {
      sessionId: 's-billing-2', sessionTitle: 'Refactor invoice ledger query path',
      project: 'billing-service', time: '2h ago',
      badge: 'tool_result',
      snippet: 'ledger_balances LEFT JOIN merchants ON ... <mark>FOR UPDATE</mark> SKIP LOCKED',
      target: 'T7',
    },
    {
      sessionId: 's-infra-1', sessionTitle: 'Audit IAM policies for prod read access',
      project: 'infra-scripts', time: '1d ago',
      badge: 'text',
      snippet: '... explained why <mark>FOR UPDATE</mark> can starve readers under high cardinality writes ...',
      target: 'T12',
    },
  ];

  // ---- Per-turn breakdown for the session report ----
  const reportByTurn = turns.map((t, i) => {
    const reqs = t.requests.length;
    const blocks = t.requests.reduce((s, r) => s + r.blocks.length, 0);
    const atts = (t.attachments || []).length;
    const cost = t.requests.reduce((s, r) => s + r.cost, 0);
    const cacheDelta = i === 0 ? 9200 : Math.round(800 + Math.random() * 4000) + atts * 1800;
    return {
      id: t.id, prompt: t.prompt, requests: reqs, blocks, attachments: atts, cacheDelta, cost,
    };
  });

  const reportByModel = [
    { agent: 'main',       model: 'claude-sonnet-4-5', input: 121400, c5: 0,    c1: 0,     cRd: 178400, output:  7480, hit: 0.59, cost: 3.71 },
    { agent: 'subagent-1', model: 'claude-haiku-4-5',  input:  21400, c5: 4200, c1: 0,     cRd:  42100, output:  2120, hit: 0.61, cost: 0.62 },
    { agent: 'main',       model: 'claude-haiku-4-5',  input:   8200, c5: 0,    c1: 0,     cRd:  18400, output:   840, hit: 0.69, cost: 0.49 },
  ];

  const filesTouched = [
    { path: 'src/jobs/reconcile.ts',          reads: 1, writes: 1, changed: true,  count: 'r1 · w1', pips: [{ t: 0.18, k: 'r' }, { t: 0.22, k: 'w' }] },
    { path: 'src/webhooks/payout.ts',         reads: 1, writes: 1, changed: true,  count: 'r1 · w1', pips: [{ t: 0.05, k: 'r' }, { t: 0.40, k: 'w' }] },
    { path: 'src/webhooks/dispute.ts',        reads: 1, writes: 1, changed: true,  count: 'r1 · w1', pips: [{ t: 0.62, k: 'r' }, { t: 0.74, k: 'w' }] },
    { path: 'src/webhooks/invoice.ts',        reads: 1, writes: 1, changed: true,  count: 'r1 · w1', pips: [{ t: 0.64, k: 'r' }, { t: 0.78, k: 'w' }] },
    { path: 'src/webhooks/subscription.ts',   reads: 1, writes: 0, changed: false, count: 'r1', pips: [{ t: 0.66, k: 'r' }] },
    { path: 'src/webhooks/payout.test.ts',    reads: 1, writes: 1, changed: true,  count: 'r1 · w1', pips: [{ t: 0.48, k: 'r' }, { t: 0.52, k: 'w' }] },
    { path: 'src/jobs/reconcile.test.ts',     reads: 1, writes: 0, changed: false, count: 'r1', pips: [{ t: 0.32, k: 'r' }] },
    { path: 'migrations/006_webhook_events.sql', reads: 0, writes: 1, changed: true, count: 'w1', pips: [{ t: 0.38, k: 'w' }] },
  ];

  // Spike turns — top 3 by cost
  const spikes = [...reportByTurn].sort((a, b) => b.cost - a.cost).slice(0, 3);

  return {
    projects,
    activeSession,
    searchResults,
    report: {
      duration: '23m 07s',
      turnCount: turns.length,
      toolCallsMain: 17,
      toolCallsSub: 5,
      cacheHit: 0.59,
      totalCost: 4.82,
      model: 'claude-sonnet-4-5',
      byModel: reportByModel,
      byTurn: reportByTurn,
      spikes,
      files: filesTouched,
    },
  };
})();
