// The game's icon set — small procedural stroke SVGs, all on currentColor so chips/buttons tint
// them via CSS. 1.5px strokes, 16x16 viewBox, no emoji anywhere (design-system rule).

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({ size = 16, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Power — bolt. */
export function IconBolt(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 1.5 3.5 9H7l-1 5.5L11.5 7H8l1-5.5Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Cooling — fan. */
export function IconFan(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
      <path d="M8 6.5C8 3.8 9.6 2.2 11 3c1.4.8.6 3-1.6 3.9" />
      <path d="M9.3 8.8c2.3-1.4 4.5-.8 4.5.8 0 1.6-2.3 2-4.2.7" />
      <path d="M6.7 8.7c-2.3 1.4-4.5.8-4.5-.8 0-1.6 2.3-2 4.2-.7" />
      <path d="M8 9.5c0 2.7-1.6 4.3-3 3.5-1.4-.8-.6-3 1.6-3.9" />
    </Svg>
  );
}

/** Rack — server cabinet with slots. */
export function IconRack(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="1.5" width="9" height="13" rx="1" />
      <path d="M5.5 4.5h5M5.5 7.5h5M5.5 10.5h5" />
      <circle cx="10.2" cy="12.6" r="0.7" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Network — switch with uplink. */
export function IconSwitch(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="2.5" y="9.5" width="11" height="4.5" rx="1" />
      <path d="M4.5 11.8h.01M6.7 11.8h.01M8.9 11.8h.01M11.1 11.8h.01" strokeWidth="1.8" />
      <path d="M8 9.5V5M8 5 5.8 7.2M8 5l2.2 2.2" />
    </Svg>
  );
}

/** Sell — recycle/refund arrow. */
export function IconSell(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 6.5a5 5 0 0 1 9.3-1.2" />
      <path d="M12.5 2.5v3h-3" />
      <path d="M13 9.5a5 5 0 0 1-9.3 1.2" />
      <path d="M3.5 13.5v-3h3" />
    </Svg>
  );
}

/** Select / inspect — cursor. */
export function IconCursor(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 2.5 12.5 8 8.6 9.1 6.5 13.5 4 2.5Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Research — flask. */
export function IconFlask(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.5 2h3M7 2v4l-3.4 6a1.6 1.6 0 0 0 1.4 2.5h6a1.6 1.6 0 0 0 1.4-2.5L9 6V2" />
      <path d="M5.2 10.5h5.6" />
    </Svg>
  );
}

/** Contracts — document with signature line. */
export function IconScroll(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 1.5h6.5L13 4v10.5H4V1.5Z" />
      <path d="M10.5 1.5V4H13" />
      <path d="M6 7h4.5M6 9.5h4.5M6 12h2.5" />
    </Svg>
  );
}

/** Cash — coin stack. */
export function IconCoins(p: IconProps) {
  return (
    <Svg {...p}>
      <ellipse cx="8" cy="4" rx="5" ry="2.2" />
      <path d="M3 4v4c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2V4" />
      <path d="M3 8v4c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2V8" />
    </Svg>
  );
}

/** Operator level — hex badge. */
export function IconHex(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 1.5 13.6 4.75v6.5L8 14.5 2.4 11.25v-6.5L8 1.5Z" />
    </Svg>
  );
}

/** Quests — target. */
export function IconTarget(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="3" />
      <circle cx="8" cy="8" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Locked. */
export function IconLock(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="7" width="9" height="7" rx="1.2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </Svg>
  );
}

/** Claim / done — check. */
export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m3 8.5 3.2 3.2L13 5" />
    </Svg>
  );
}

/** Star — milestones / wins. */
export function IconStar(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        d="M8 1.8l1.9 3.85 4.25.62-3.07 3 .72 4.23L8 11.5l-3.8 2 .72-4.23-3.07-3 4.25-.62L8 1.8Z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  );
}

/** Crew / builders — hard hat. */
export function IconHardHat(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2.5 11.5h11" />
      <path d="M4 11.5a4 4 0 0 1 8 0Z" fill="currentColor" stroke="none" />
      <path d="M4 11.5a4 4 0 0 1 8 0" />
      <path d="M8 4.2v2.6M6 5.4l.6 1.6M10 5.4l-.6 1.6" />
    </Svg>
  );
}

/** Serving — activity pulse. */
export function IconPulse(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M1.5 8.5h3l1.6-4.5 2.6 8 1.8-5 1 1.5h3" />
    </Svg>
  );
}

/** Help. */
export function IconHelp(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M6.2 6.2a1.9 1.9 0 0 1 3.7.6c0 1.2-1.8 1.4-1.8 2.6" />
      <circle cx="8" cy="11.6" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Close. */
export function IconX(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Svg>
  );
}
