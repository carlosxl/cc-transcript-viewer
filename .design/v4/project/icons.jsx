// Inline SVG icon set — stroke 1.5, currentColor, 14px nominal.
// Keep these minimal and consistent. No fills.

const Icon = ({ d, size = 14, fill, stroke = 'currentColor', sw = 1.5, viewBox = '0 0 24 24', children, ...rest }) => (
  <svg
    width={size} height={size} viewBox={viewBox}
    fill={fill || 'none'} stroke={stroke} strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round"
    {...rest}
  >
    {d ? <path d={d} /> : children}
  </svg>
);

const I = {
  search: (p) => <Icon size={14} {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Icon>,
  chevronRight: (p) => <Icon size={12} {...p} d="m9 6 6 6-6 6"/>,
  chevronLeft: (p) => <Icon size={12} {...p} d="m15 6-6 6 6 6"/>,
  chevronDown: (p) => <Icon size={10} {...p} d="m6 9 6 6 6-6"/>,
  chevronUp: (p) => <Icon size={10} {...p} d="m18 15-6-6-6 6"/>,
  arrowRight: (p) => <Icon size={14} {...p}><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></Icon>,
  folder: (p) => <Icon size={11} {...p} d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
  star: (p) => <Icon size={10} fill="currentColor" stroke="none" {...p}><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 17.8 5.7 21.2 7 14.2 2 9.4l7-.9z"/></Icon>,
  pinOutline: (p) => <Icon size={10} {...p}><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 17.8 5.7 21.2 7 14.2 2 9.4l7-.9z"/></Icon>,
  flask: (p) => <Icon size={14} {...p}><path d="M9 3h6"/><path d="M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 19l-6-10V3"/></Icon>,
  x: (p) => <Icon size={14} {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></Icon>,
  sun: (p) => <Icon size={14} {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></Icon>,
  moon: (p) => <Icon size={14} {...p} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>,
  density: (p) => <Icon size={14} {...p}><path d="M3 6h18M3 12h18M3 18h18"/></Icon>,
  panel: (p) => <Icon size={14} {...p}><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M15 4v16"/></Icon>,
  panelOff: (p) => <Icon size={14} {...p}><rect x="3" y="4" width="18" height="16" rx="1.5"/></Icon>,
  report: (p) => <Icon size={14} {...p}><path d="M3 20V10"/><path d="M9 20V4"/><path d="M15 20v-7"/><path d="M21 20V8"/></Icon>,
  more: (p) => <Icon size={14} {...p}><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></Icon>,
  brain: (p) => <Icon size={12} {...p}><path d="M9 4a3 3 0 0 0-3 3v.5a3 3 0 0 0-1 5.8V15a3 3 0 0 0 3 3v.5a2.5 2.5 0 0 0 5 0V5.5A2.5 2.5 0 0 0 9 4Z"/><path d="M15 4a3 3 0 0 1 3 3v.5a3 3 0 0 1 1 5.8V15a3 3 0 0 1-3 3v.5a2.5 2.5 0 0 1-5 0"/></Icon>,
  zap: (p) => <Icon size={12} {...p} d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>,
  agent: (p) => <Icon size={14} {...p}><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M12 6V3"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><path d="M9 16h6"/></Icon>,
  terminal: (p) => <Icon size={12} {...p}><path d="m4 7 4 4-4 4"/><path d="M12 15h8"/></Icon>,
  enter: (p) => <Icon size={11} {...p}><path d="M9 10 5 14l4 4"/><path d="M5 14h11a4 4 0 0 0 4-4V6"/></Icon>,
  copy: (p) => <Icon size={12} {...p}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></Icon>,
  link: (p) => <Icon size={11} {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1"/></Icon>,
  attach: (p) => <Icon size={12} {...p} d="m21 12-9.5 9.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5L9.5 19.5a2 2 0 0 1-3-3L15 8"/>,
  bullet: (p) => <Icon size={6} fill="currentColor" stroke="none" {...p}><circle cx="12" cy="12" r="8"/></Icon>,
};

window.I = I;
