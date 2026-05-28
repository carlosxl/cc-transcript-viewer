// Sidebar — session browser

const { useState, useMemo } = React;

function fmtCost(c) {
  if (c === null || c === undefined) return '—';
  return '$' + c.toFixed(2);
}
function fmtK(n) {
  if (n < 1000) return String(n);
  return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
}

function CostWithTip({ cost, tokens }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      className="cost"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative' }}
    >
      {fmtCost(cost)}
      {hover && tokens && (
        <span className="cost-tip">
          <div className="cost-tip-row"><span>input</span><span>{fmtK(tokens.in)}</span></div>
          <div className="cost-tip-row"><span>output</span><span>{fmtK(tokens.out)}</span></div>
          <div className="cost-tip-row"><span>cache create</span><span>{fmtK(tokens.cc)}</span></div>
          <div className="cost-tip-row"><span>cache read</span><span>{fmtK(tokens.cr)}</span></div>
        </span>
      )}
    </span>
  );
}

function SessionRow({ session, active, onClick }) {
  return (
    <div
      className="sb-row"
      data-active={active || undefined}
      onClick={onClick}
    >
      <div className="sb-row-title">
        {session.pinned && (
          <span className="sb-pin" aria-label="pinned">
            <I.star />
          </span>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.title}</span>
        {session.live && <span className="sb-live" aria-label="live" />}
      </div>
      <div className="sb-row-meta">
        <span>{session.time}</span>
        <span>{session.messages} msgs</span>
        <CostWithTip cost={session.cost} tokens={session.tokens} />
      </div>
    </div>
  );
}

function Sidebar({ projects, activeSessionId, onSelectSession, onOpenSearch }) {
  const [collapsed, setCollapsed] = useState({});
  const toggle = (id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-brand-mark">cc</div>
        <div className="sb-brand-name">cc-transcript-viewer</div>
        <div className="sb-brand-tag">local</div>
      </div>
      <button className="sb-search" onClick={onOpenSearch}>
        <I.search />
        <span>Search sessions, tools, files…</span>
        <span className="sb-search-kbd">
          <span className="kbd">⌘</span><span className="kbd">K</span>
        </span>
      </button>

      <div className="sb-list">
        {projects.map((p) => {
          const isCollapsed = !!collapsed[p.id];
          return (
            <div key={p.id} className="sb-group" data-collapsed={isCollapsed || undefined}>
              <div className="sb-group-header" onClick={() => toggle(p.id)}>
                <span className="sb-group-chev"><I.chevronDown /></span>
                <span className="sb-folder-ico"><I.folder /></span>
                <span className="sb-group-name">{p.name}</span>
                <span className="sb-group-count">{p.sessions.length}</span>
              </div>
              {!isCollapsed && p.sessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  active={s.id === activeSessionId}
                  onClick={() => onSelectSession(s.id, p.id)}
                />
              ))}
            </div>
          );
        })}

        <div style={{ height: 14 }} />
        <div className="sb-group">
          <div className="sb-group-header">
            <span style={{ width: 10 }} />
            <span className="sb-folder-ico"><I.flask /></span>
            <span className="sb-group-name muted">No more sessions yet</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar, CostWithTip, fmtCost, fmtK });
