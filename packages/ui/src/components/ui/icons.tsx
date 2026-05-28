import type { SVGProps } from 'react'

/**
 * Inline SVG icon set — stroke 1.5, currentColor, custom per-icon defaults.
 * Ported from .design/v4/project/icons.jsx; consumed across the workspace
 * as `import { I } from '@/components/ui/icons'`.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function svg(
  defaultSize: number,
  viewBox: string,
  content: React.ReactNode,
  opts: { fill?: string; stroke?: string } = {},
) {
  return function Icon({ size = defaultSize, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill={opts.fill ?? 'none'}
        stroke={opts.stroke ?? 'currentColor'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {content}
      </svg>
    )
  }
}

export const I = {
  search: svg(14, '0 0 24 24', <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>),
  chevronRight: svg(12, '0 0 24 24', <path d="m9 6 6 6-6 6" />),
  chevronLeft:  svg(12, '0 0 24 24', <path d="m15 6-6 6 6 6" />),
  chevronDown:  svg(10, '0 0 24 24', <path d="m6 9 6 6 6-6" />),
  chevronUp:    svg(10, '0 0 24 24', <path d="m18 15-6-6-6 6" />),
  arrowRight: svg(14, '0 0 24 24', <>
    <path d="M5 12h14" />
    <path d="m13 5 7 7-7 7" />
  </>),
  folder: svg(11, '0 0 24 24',
    <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  ),
  star: svg(10, '0 0 24 24',
    <path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 17.8 5.7 21.2 7 14.2 2 9.4l7-.9z" />,
    { fill: 'currentColor', stroke: 'none' },
  ),
  pinOutline: svg(10, '0 0 24 24',
    <path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 17.8 5.7 21.2 7 14.2 2 9.4l7-.9z" />,
  ),
  flask: svg(14, '0 0 24 24', <>
    <path d="M9 3h6" />
    <path d="M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 19l-6-10V3" />
  </>),
  x: svg(14, '0 0 24 24', <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>),
  sun: svg(14, '0 0 24 24', <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>),
  moon: svg(14, '0 0 24 24', <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />),
  density: svg(14, '0 0 24 24', <path d="M3 6h18M3 12h18M3 18h18" />),
  panel: svg(14, '0 0 24 24', <>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <path d="M15 4v16" />
  </>),
  panelOff: svg(14, '0 0 24 24', <rect x="3" y="4" width="18" height="16" rx="1.5" />),
  report: svg(14, '0 0 24 24', <>
    <path d="M3 20V10" />
    <path d="M9 20V4" />
    <path d="M15 20v-7" />
    <path d="M21 20V8" />
  </>),
  more: svg(14, '0 0 24 24', <>
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
  </>),
  brain: svg(12, '0 0 24 24', <>
    <path d="M9 4a3 3 0 0 0-3 3v.5a3 3 0 0 0-1 5.8V15a3 3 0 0 0 3 3v.5a2.5 2.5 0 0 0 5 0V5.5A2.5 2.5 0 0 0 9 4Z" />
    <path d="M15 4a3 3 0 0 1 3 3v.5a3 3 0 0 1 1 5.8V15a3 3 0 0 1-3 3v.5a2.5 2.5 0 0 1-5 0" />
  </>),
  zap: svg(12, '0 0 24 24', <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />),
  agent: svg(14, '0 0 24 24', <>
    <rect x="4" y="6" width="16" height="12" rx="2" />
    <path d="M12 6V3" />
    <circle cx="9" cy="12" r="1" fill="currentColor" />
    <circle cx="15" cy="12" r="1" fill="currentColor" />
    <path d="M9 16h6" />
  </>),
  terminal: svg(12, '0 0 24 24', <>
    <path d="m4 7 4 4-4 4" />
    <path d="M12 15h8" />
  </>),
  enter: svg(11, '0 0 24 24', <>
    <path d="M9 10 5 14l4 4" />
    <path d="M5 14h11a4 4 0 0 0 4-4V6" />
  </>),
  copy: svg(12, '0 0 24 24', <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>),
  link: svg(11, '0 0 24 24', <>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1" />
  </>),
  attach: svg(12, '0 0 24 24',
    <path d="m21 12-9.5 9.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5L9.5 19.5a2 2 0 0 1-3-3L15 8" />,
  ),
  bullet: svg(6, '0 0 24 24',
    <circle cx="12" cy="12" r="8" />,
    { fill: 'currentColor', stroke: 'none' },
  ),
  compact: svg(14, '0 0 24 24', <>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
    <path d="m7 9 5-3 5 3" />
    <path d="m7 15 5 3 5-3" />
  </>),
} as const

export type IconName = keyof typeof I
