// App — top-level wiring, keyboard, focus, live tail, subagent stack

const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp, useMemo: useMemoApp, useCallback } = React;

function App() {
  const data = window.SAMPLE;

  // theme + density
  const [theme, setTheme] = useStateApp('dark');
  const [density, setDensity] = useStateApp('comfortable');
  useEffectApp(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-density', density);
  }, [theme, density]);

  const [inspectorOpen, setInspectorOpen] = useStateApp(true);

  // session stack for subagent push/pop. Stack holds {session, parentLabel}
  const [stack, setStack] = useStateApp([{ session: data.activeSession, parentLabel: null }]);
  const currentSession = stack[stack.length - 1].session;
  const isSubagent = stack.length > 1;
  const parentBackLabel = isSubagent ? stack[stack.length - 2].session.title : null;

  // focus state — node id (request or user msg) + optional block id
  const [focusedNodeId, setFocusedNodeId] = useStateApp(null);
  const [focusedNodeMeta, setFocusedNodeMeta] = useStateApp(null);
  const [focusedBlockId, setFocusedBlockId] = useStateApp(null);
  const [focusedBlockMeta, setFocusedBlockMeta] = useStateApp(null);

  // overlays
  const [searchOpen, setSearchOpen] = useStateApp(false);
  const [reportOpen, setReportOpen] = useStateApp(false);
  const [jumperOpen, setJumperOpen] = useStateApp(false);
  const [jumperAnchor, setJumperAnchor] = useStateApp(null);

  // live tail
  const [livePending, setLivePending] = useStateApp(false);
  const [extraTurns, setExtraTurns] = useStateApp([]);
  const [showTailToast, setShowTailToast] = useStateApp(false);

  const bodyRef = useRefApp(null);

  // Default focus on session open: last Turn
  useEffectApp(() => {
    const turns = currentSession.turns;
    if (!turns || turns.length === 0) return;
    const lastTurn = turns[turns.length - 1];
    const lastReq = lastTurn.requests[lastTurn.requests.length - 1];
    if (lastReq) {
      setFocusedNodeId(lastReq.id);
      setFocusedNodeMeta({ kind: 'request', turn: lastTurn, request: lastReq, idx: lastTurn.requests.length - 1, total: lastTurn.requests.length });
    } else {
      setFocusedNodeId(lastTurn.userMsgId);
      setFocusedNodeMeta({ kind: 'user', turn: lastTurn });
    }
    setFocusedBlockId(null);
    setFocusedBlockMeta(null);
    // scroll to bottom (no smooth behavior on initial load)
    const jump = () => {
      if (bodyRef.current) {
        const prev = bodyRef.current.style.scrollBehavior;
        bodyRef.current.style.scrollBehavior = 'auto';
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
        bodyRef.current.style.scrollBehavior = prev;
      }
    };
    // run twice — once after first paint, once after fonts settle
    setTimeout(jump, 0);
    setTimeout(jump, 80);
    setTimeout(jump, 350);
  }, [currentSession.id]);

  // live tail simulation (only on root session)
  useEffectApp(() => {
    if (isSubagent) return;
    const t1 = setTimeout(() => {
      // surface "live" chip and one pending turn
      setLivePending(true);
      const t2 = setTimeout(() => {
        // new turn arrives
        setExtraTurns([data.activeSession.livePending]);
        setShowTailToast(true);
      }, 8200);
      return () => clearTimeout(t2);
    }, 5000);
    return () => clearTimeout(t1);
  }, [isSubagent]);

  // Compose session-with-extra-turns
  const sessionView = useMemoApp(() => {
    if (isSubagent) return currentSession;
    if (extraTurns.length === 0) return currentSession;
    return { ...currentSession, turns: [...currentSession.turns, ...extraTurns] };
  }, [currentSession, extraTurns, isSubagent]);

  // ---------- focus helpers ----------
  const onFocusNode = useCallback((id, meta) => {
    setFocusedNodeId(id);
    setFocusedNodeMeta(meta);
    setFocusedBlockId(null);
    setFocusedBlockMeta(null);
  }, []);
  const onFocusBlock = useCallback((bid, block, request, turn) => {
    setFocusedNodeId(request.id);
    setFocusedNodeMeta({ kind: 'request', turn, request, idx: turn.requests.indexOf(request), total: turn.requests.length });
    setFocusedBlockId(bid);
    setFocusedBlockMeta({ block, request, turn });
    if (!inspectorOpen) setInspectorOpen(true);
  }, [inspectorOpen]);

  const scrollNodeIntoView = (id) => {
    setTimeout(() => {
      const el = document.querySelector(`[data-node-id="${id}"]`);
      if (el && bodyRef.current) {
        const rect = el.getBoundingClientRect();
        const cRect = bodyRef.current.getBoundingClientRect();
        const top = bodyRef.current.scrollTop + (rect.top - cRect.top) - 110;
        bodyRef.current.scrollTo({ top, behavior: 'smooth' });
      }
    }, 20);
  };

  // ---------- navigation ----------
  const flatNodes = useMemoApp(() => {
    // [{ id, meta }] in document order across the session
    const items = [];
    sessionView.turns.forEach((t) => {
      items.push({ id: t.userMsgId, meta: { kind: 'user', turn: t } });
      t.requests.forEach((r, i) => {
        items.push({ id: r.id, meta: { kind: 'request', turn: t, request: r, idx: i, total: t.requests.length } });
      });
    });
    return items;
  }, [sessionView]);

  const flatTools = useMemoApp(() => {
    const items = [];
    sessionView.turns.forEach((t) => {
      t.requests.forEach((r) => {
        r.blocks.forEach((b, bi) => {
          if (b.kind === 'tool_use' || b.kind === 'diff') {
            items.push({ bid: `${r.id}:b${bi}`, block: b, request: r, turn: t });
          }
        });
      });
    });
    return items;
  }, [sessionView]);

  const flatPrompts = useMemoApp(() => {
    return sessionView.turns
      .filter((t) => !/^\[stderr\]/.test(t.prompt))
      .map((t) => t.userMsgId);
  }, [sessionView]);

  const stepNode = useCallback((dir) => {
    const i = flatNodes.findIndex((n) => n.id === focusedNodeId);
    const ni = Math.max(0, Math.min(flatNodes.length - 1, (i < 0 ? 0 : i) + dir));
    const next = flatNodes[ni];
    if (next) { onFocusNode(next.id, next.meta); scrollNodeIntoView(next.id); }
  }, [flatNodes, focusedNodeId, onFocusNode]);

  const stepTurn = useCallback((dir) => {
    const turns = sessionView.turns;
    const curId = focusedNodeMeta?.turn?.id;
    const idx = Math.max(0, turns.findIndex((t) => t.id === curId));
    const nextIdx = Math.max(0, Math.min(turns.length - 1, idx + dir));
    const nt = turns[nextIdx];
    if (!nt) return;
    const r = nt.requests[0];
    if (r) {
      onFocusNode(r.id, { kind: 'request', turn: nt, request: r, idx: 0, total: nt.requests.length });
      scrollNodeIntoView(r.id);
    } else {
      onFocusNode(nt.userMsgId, { kind: 'user', turn: nt });
      scrollNodeIntoView(nt.userMsgId);
    }
  }, [sessionView, focusedNodeMeta, onFocusNode]);

  const stepRequest = useCallback((dir) => {
    if (!focusedNodeMeta?.request) {
      stepTurn(dir);
      return;
    }
    const turns = sessionView.turns;
    const ti = turns.indexOf(focusedNodeMeta.turn);
    const ri = focusedNodeMeta.idx + dir;
    if (ri >= 0 && ri < focusedNodeMeta.turn.requests.length) {
      const r = focusedNodeMeta.turn.requests[ri];
      onFocusNode(r.id, { kind: 'request', turn: focusedNodeMeta.turn, request: r, idx: ri, total: focusedNodeMeta.turn.requests.length });
      scrollNodeIntoView(r.id);
    } else {
      // roll into next turn
      const nti = ti + (dir > 0 ? 1 : -1);
      if (nti >= 0 && nti < turns.length) {
        const nt = turns[nti];
        const idx = dir > 0 ? 0 : nt.requests.length - 1;
        const nr = nt.requests[idx];
        if (nr) {
          onFocusNode(nr.id, { kind: 'request', turn: nt, request: nr, idx, total: nt.requests.length });
          scrollNodeIntoView(nr.id);
        }
      }
    }
  }, [focusedNodeMeta, sessionView, stepTurn, onFocusNode]);

  const stepPrompt = useCallback((dir) => {
    const turns = sessionView.turns;
    const curT = focusedNodeMeta?.turn;
    const curTI = curT ? turns.indexOf(curT) : -1;
    // find next/prev turn whose id is in flatPrompts
    let i = curTI + dir;
    while (i >= 0 && i < turns.length) {
      const t = turns[i];
      if (flatPrompts.includes(t.userMsgId)) {
        onFocusNode(t.userMsgId, { kind: 'user', turn: t });
        scrollNodeIntoView(t.userMsgId);
        return;
      }
      i += dir;
    }
  }, [sessionView, focusedNodeMeta, flatPrompts, onFocusNode]);

  const stepTool = useCallback((dir) => {
    if (flatTools.length === 0) return;
    let curIdx = -1;
    if (focusedBlockId) curIdx = flatTools.findIndex((x) => x.bid === focusedBlockId);
    if (curIdx < 0 && focusedNodeMeta?.request) {
      // pick first/last tool in this request as base
      curIdx = flatTools.findIndex((x) => x.request === focusedNodeMeta.request);
      if (curIdx < 0) curIdx = 0;
    }
    if (curIdx < 0) curIdx = dir > 0 ? -1 : flatTools.length;
    let ni = curIdx + dir;
    if (ni < 0) ni = 0;
    if (ni > flatTools.length - 1) ni = flatTools.length - 1;
    const next = flatTools[ni];
    if (next) {
      onFocusBlock(next.bid, next.block, next.request, next.turn);
      scrollNodeIntoView(next.request.id);
    }
  }, [flatTools, focusedBlockId, focusedNodeMeta, onFocusBlock]);

  // ---------- subagent drill ----------
  const onSubagentDrill = useCallback((ref) => {
    const sub = currentSession.subagents && currentSession.subagents[ref];
    if (!sub) return;
    setStack((s) => [...s, { session: sub, parentLabel: currentSession.title }]);
  }, [currentSession]);

  const onBack = useCallback(() => {
    setStack((s) => s.slice(0, -1));
  }, []);

  // ---------- session pick from sidebar ----------
  const onSelectSession = useCallback((sid) => {
    if (sid === data.activeSession.id) {
      setStack([{ session: data.activeSession, parentLabel: null }]);
    } else {
      // Build a stub session for non-active picks so the UI feels alive.
      // (Spec says one user pick = make it active. Real impl would load JSONL.)
      // For prototype: show a brief notice.
    }
  }, []);

  // ---------- search palette pick ----------
  const onSearchPick = useCallback((r) => {
    setSearchOpen(false);
    if (r.sessionId === data.activeSession.id) {
      setStack([{ session: data.activeSession, parentLabel: null }]);
      // focus the target turn
      setTimeout(() => {
        const target = data.activeSession.turns.find((t) => t.id === r.target);
        if (target) {
          onFocusNode(target.requests[0].id, { kind: 'request', turn: target, request: target.requests[0], idx: 0, total: target.requests.length });
          scrollNodeIntoView(target.requests[0].id);
        }
      }, 60);
    }
  }, [onFocusNode]);

  // ---------- jumper pick ----------
  const onJumperPick = useCallback((t) => {
    setJumperOpen(false);
    if (t.requests[0]) {
      onFocusNode(t.requests[0].id, { kind: 'request', turn: t, request: t.requests[0], idx: 0, total: t.requests.length });
      scrollNodeIntoView(t.requests[0].id);
    } else {
      onFocusNode(t.userMsgId, { kind: 'user', turn: t });
      scrollNodeIntoView(t.userMsgId);
    }
  }, [onFocusNode]);

  // ---------- inspector block jump ----------
  const onJumpToBlock = useCallback((bid, block, request, turn) => {
    onFocusBlock(bid, block, request, turn);
    scrollNodeIntoView(request.id);
  }, [onFocusBlock]);

  // ---------- keyboard ----------
  useEffectApp(() => {
    const gTimer = { last: 0 };
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const inInput = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

      // ESC priority: jumper → report → search → clear block focus / inspector
      if (e.key === 'Escape') {
        if (jumperOpen) { setJumperOpen(false); return; }
        if (reportOpen) { setReportOpen(false); return; }
        if (searchOpen) { setSearchOpen(false); return; }
        if (focusedBlockId) { setFocusedBlockId(null); setFocusedBlockMeta(null); return; }
        return;
      }

      if (inInput) return;

      // Cmd/Ctrl-K and / open search
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); setSearchOpen(true); return;
      }
      if (e.key === '/' && !searchOpen) { e.preventDefault(); setSearchOpen(true); return; }

      // Don't intercept other shortcuts while overlays are open
      if (searchOpen || reportOpen || jumperOpen) return;

      if (e.key === 'j' && !e.shiftKey) { e.preventDefault(); stepNode(1); return; }
      if (e.key === 'k' && !e.shiftKey) { e.preventDefault(); stepNode(-1); return; }
      if (e.key === 'J' && e.shiftKey) { e.preventDefault(); stepTurn(1); return; }
      if (e.key === 'K' && e.shiftKey) { e.preventDefault(); stepTurn(-1); return; }
      if (e.key === 'n' && !e.shiftKey) { e.preventDefault(); stepPrompt(1); return; }
      if (e.key === 'N' && e.shiftKey) { e.preventDefault(); stepPrompt(-1); return; }
      if (e.key === '[') { e.preventDefault(); stepTool(-1); return; }
      if (e.key === ']') { e.preventDefault(); stepTool(1); return; }
      if (e.key === 'T' && e.shiftKey) { e.preventDefault(); setJumperOpen(true); return; }
      if (e.key === 't' && !e.shiftKey) {
        // Detect double-t for jumper? Spec is `T` (shift). Single t = theme.
        setTheme((th) => th === 'dark' ? 'light' : 'dark'); return;
      }
      if (e.key === 'r' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault(); setReportOpen((o) => !o); return;
      }
      if (e.key === 'g' && !e.shiftKey) {
        const now = Date.now();
        if (now - gTimer.last < 700) {
          // gg → first
          const first = sessionView.turns[0];
          if (first?.requests[0]) onFocusNode(first.requests[0].id, { kind: 'request', turn: first, request: first.requests[0], idx: 0, total: first.requests.length });
          if (bodyRef.current) bodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          gTimer.last = 0;
        } else {
          gTimer.last = now;
        }
        return;
      }
      if (e.key === 'G' && e.shiftKey) {
        // last
        const turns = sessionView.turns;
        const last = turns[turns.length - 1];
        if (last?.requests[last.requests.length - 1]) {
          const r = last.requests[last.requests.length - 1];
          onFocusNode(r.id, { kind: 'request', turn: last, request: r, idx: last.requests.length - 1, total: last.requests.length });
        }
        if (bodyRef.current) bodyRef.current.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
        setShowTailToast(false);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (bodyRef.current) {
          const dir = e.shiftKey ? -1 : 1;
          bodyRef.current.scrollBy({ top: dir * (bodyRef.current.clientHeight * 0.85), behavior: 'smooth' });
        }
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, reportOpen, jumperOpen, focusedBlockId, sessionView, stepNode, stepTurn, stepPrompt, stepTool, onFocusNode]);

  // ---------- status bar position ----------
  const positionCrumb = useMemoApp(() => {
    if (!focusedNodeMeta) return 'No focus';
    const t = focusedNodeMeta.turn;
    if (focusedNodeMeta.kind === 'request') return { turn: t.id, req: `${focusedNodeMeta.idx + 1}/${focusedNodeMeta.total}` };
    return { turn: t.id, user: true };
  }, [focusedNodeMeta]);

  return (
    <div className="app">
      <div className="workspace" data-inspector-hidden={!inspectorOpen || undefined}>
        <Sidebar
          projects={data.projects}
          activeSessionId={isSubagent ? null : currentSession.id}
          onSelectSession={onSelectSession}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <Transcript
          session={sessionView}
          focusedNodeId={focusedNodeId}
          focusedBlockId={focusedBlockId}
          focusedNodeMeta={focusedNodeMeta}
          onFocusNode={(id, meta) => { onFocusNode(id, meta); scrollNodeIntoView(id); }}
          onFocusBlock={onFocusBlock}
          onFocusTurn={(t) => onFocusNode(t.userMsgId, { kind: 'user', turn: t })}
          onSubagentDrill={onSubagentDrill}
          livePending={livePending && !isSubagent}
          onFollowTail={() => { if (bodyRef.current) bodyRef.current.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }); setShowTailToast(false); }}
          showTailToast={showTailToast}
          onTurnStep={stepTurn}
          onReqStep={stepRequest}
          onPromptStep={stepPrompt}
          onToolStep={stepTool}
          onOpenJumper={(e) => {
            const rect = e?.currentTarget?.getBoundingClientRect();
            setJumperAnchor(rect);
            setJumperOpen(true);
          }}
          isSubagent={isSubagent}
          parentBackLabel={parentBackLabel}
          onBack={onBack}
          onOpenReport={() => setReportOpen(true)}
          onToggleInspector={() => setInspectorOpen((o) => !o)}
          inspectorOpen={inspectorOpen}
          onToggleTheme={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}
          theme={theme}
          onToggleDensity={() => setDensity((d) => d === 'comfortable' ? 'compact' : 'comfortable')}
          density={density}
          bodyRef={bodyRef}
        />
        {inspectorOpen && (
          <Inspector
            focusedNodeMeta={focusedNodeMeta}
            focusedBlockMeta={focusedBlockMeta}
            onJumpToBlock={onJumpToBlock}
            onSubagentDrill={onSubagentDrill}
          />
        )}
      </div>

      <StatusBar position={positionCrumb} />

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        results={data.searchResults}
        onPick={onSearchPick}
      />
      <TurnJumper
        open={jumperOpen}
        onClose={() => setJumperOpen(false)}
        anchorRect={jumperAnchor}
        turns={sessionView.turns}
        focusedTurnId={focusedNodeMeta?.turn?.id}
        onPick={onJumperPick}
      />
      <SessionReport
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        report={data.report}
        sessionTitle={data.activeSession.title}
      />
    </div>
  );
}

function StatusBar({ position }) {
  return (
    <div className="status">
      <span className="crumb">
        {position && position !== 'No focus' ? (
          <>
            <span>Turn </span><span className="focus">{position.turn}</span>
            <span className="sep">›</span>
            {position.user ? <span>User input</span> : <><span>Request </span><span className="focus">{position.req}</span></>}
          </>
        ) : (
          <span>No focus</span>
        )}
      </span>
      <span className="hints">
        <span className="hint"><span className="kg"><span className="kbd">j</span><span style={{ color: 'var(--text-disabled)' }}>/</span><span className="kbd">k</span></span> step</span>
        <span className="hint"><span className="kg"><span className="kbd">⇧J</span><span style={{ color: 'var(--text-disabled)' }}>/</span><span className="kbd">⇧K</span></span> turn</span>
        <span className="hint"><span className="kg"><span className="kbd">n</span></span> prompt</span>
        <span className="hint"><span className="kg"><span className="kbd">[</span><span style={{ color: 'var(--text-disabled)' }}>/</span><span className="kbd">]</span></span> tool</span>
        <span className="hint"><span className="kbd">T</span> turns</span>
        <span className="hint"><span className="kbd">r</span> report</span>
        <span className="hint"><span className="kbd">⌘K</span> search</span>
        <span className="hint"><span className="kbd">⇧G</span> tail</span>
        <span className="hint"><span className="kbd">t</span> theme</span>
      </span>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
