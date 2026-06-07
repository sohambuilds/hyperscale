import { type CSSProperties, type ReactNode, useId } from "react";

import { InfoTooltip } from "../InfoTooltip";
import { clamp, type Strains, type Zone } from "../../mission";

// Generative data-viz: the hard triangle (hero), radial gauges, sparklines, the traffic
// waveform. All SVG, driven by live derived metrics — the design system's "texture comes from
// the content" rule (no decorative imagery).

type Pt = [number, number];
const pol = (cx: number, cy: number, r: number, deg: number): Pt => {
  const a = (deg - 90) * (Math.PI / 180);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const ptsStr = (a: Pt[]): string => a.map((p) => p.join(",")).join(" ");

interface Corner {
  key: keyof Strains;
  deg: number;
  color: string;
  rgb: string;
  label: string;
  sub: string;
}

const CORNERS: Corner[] = [
  { key: "latency", deg: 0, color: "var(--c-cyan)", rgb: "34,211,238", label: "LATENCY", sub: "SLOs" },
  { key: "cost", deg: 120, color: "var(--c-amber)", rgb: "251,191,36", label: "COST & POWER", sub: "$ · kW" },
  { key: "traffic", deg: 240, color: "var(--c-magenta)", rgb: "244,114,182", label: "TRAFFIC", sub: "req/s" },
];

interface HardTriangleProps {
  strains: Strains;
  size?: number;
}

/**
 * THE HARD TRIANGLE — latency ⟷ cost & power ⟷ traffic. Each corner pulls outward with its
 * strain (radar); the whole frame physically leans toward whichever corner is under the most
 * strain, easing on a spring so the consequence is felt, not just shown.
 */
export function HardTriangle({ strains, size = 340 }: HardTriangleProps) {
  const cx = size / 2;
  const cy = size / 2 + 6;
  const R = size * 0.34;
  const sv = (k: keyof Strains): number => clamp(strains[k] ?? 0, 0, 1.25);

  const outer = CORNERS.map((c) => pol(cx, cy, R, c.deg));
  const inner = CORNERS.map((c) => pol(cx, cy, R * clamp(sv(c.key), 0.06, 1.0), c.deg));

  // lean vector — sum of corner directions weighted by strain
  let lx = 0;
  let ly = 0;
  for (const c of CORNERS) {
    const [px, py] = pol(0, 0, sv(c.key), c.deg);
    lx += px;
    ly += py;
  }
  const leanMag = Math.hypot(lx, ly);
  const dominant = CORNERS.reduce((a, b) => (sv(b.key) > sv(a.key) ? b : a));
  const tense = sv(dominant.key) > 0.66;
  const tilt = clamp(lx * 7, -7, 7);
  const tx = clamp(lx * 12, -14, 14);
  const ty = clamp(ly * 12, -14, 14);

  const leanStyle: CSSProperties = {
    transform: `translate(${tx}px, ${ty}px) rotate(${tilt}deg)`,
    transformOrigin: `${cx}px ${cy}px`,
    transition: "transform 420ms cubic-bezier(.34,1.56,.64,1)",
  };

  return (
    <div className="triangle-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="triangle-svg" style={{ width: "100%", height: "auto" }}>
        <defs>
          <radialGradient id="tri-core" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor={`rgba(${dominant.rgb},0.20)`} />
            <stop offset="100%" stopColor="rgba(8,12,20,0)" />
          </radialGradient>
          <filter id="tri-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g style={leanStyle}>
          <circle cx={cx} cy={cy} r={R * 1.05} fill="url(#tri-core)" />
          {[0.66, 0.33].map((f) => (
            <polygon
              key={f}
              points={ptsStr(CORNERS.map((c) => pol(cx, cy, R * f, c.deg)))}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
            />
          ))}
          {CORNERS.map((c, i) => (
            <line key={c.key} x1={cx} y1={cy} x2={outer[i][0]} y2={outer[i][1]} stroke="rgba(255,255,255,0.06)" />
          ))}
          <polygon points={ptsStr(outer)} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
          <polygon
            points={ptsStr(inner)}
            fill={`rgba(${dominant.rgb},0.13)`}
            stroke={dominant.color}
            strokeWidth="2"
            strokeLinejoin="round"
            filter={tense ? "url(#tri-glow)" : undefined}
            style={{ transition: "fill 300ms linear, stroke 300ms linear" }}
          />
          {CORNERS.map((c, i) => {
            const s = sv(c.key);
            const lit = 0.3 + 0.7 * s;
            const isDom = c.key === dominant.key && tense;
            return (
              <g key={c.key}>
                <circle
                  cx={outer[i][0]}
                  cy={outer[i][1]}
                  r={isDom ? 9 : 6}
                  fill={c.color}
                  opacity={lit}
                  style={{
                    filter: `drop-shadow(0 0 ${4 + 10 * s}px rgba(${c.rgb},${0.4 + 0.5 * s}))`,
                    transition: "r 300ms var(--ease-spring), opacity 300ms linear",
                  }}
                />
                <circle cx={inner[i][0]} cy={inner[i][1]} r={3} fill="#fff" opacity="0.85" />
              </g>
            );
          })}
        </g>
      </svg>

      {/* corner labels (outside the leaning group so text stays upright) */}
      {CORNERS.map((c) => {
        const [lxp, lyp] = pol(cx, cy, R * 1.3, c.deg);
        const s = sv(c.key);
        const isDom = c.key === dominant.key && tense;
        return (
          <div
            key={c.key}
            className={"tri-label" + (isDom ? " dom" : "")}
            style={
              {
                left: `${(lxp / size) * 100}%`,
                top: `${(lyp / size) * 100}%`,
                "--lab": c.color,
                "--lab-rgb": c.rgb,
              } as CSSProperties
            }
          >
            <span className="tri-label-name">{c.label}</span>
            <span className="tri-label-val ds-num">
              {Math.round(s * 100)}
              <span className="tri-label-pct">%</span>
            </span>
          </div>
        );
      })}

      <div
        className="tri-status"
        style={{ ["--st" as string]: tense ? dominant.color : "var(--c-green)" }}
      >
        <span className="tri-status-dot" />
        {tense ? (
          <span>
            <b>{dominant.label.replace(" & POWER", "")}</b> under strain
          </span>
        ) : leanMag > 0.18 ? (
          <span>
            Leaning <b>{dominant.label.replace(" & POWER", "")}</b> · holding
          </span>
        ) : (
          <span>
            <b>Balanced</b> · all corners healthy
          </span>
        )}
      </div>
    </div>
  );
}

interface GaugeProps {
  value: number;
  max: number;
  label: ReactNode;
  format: (v: number) => string;
  zones: Zone[];
  term?: string;
  unit?: string;
  size?: number;
}

/** Radial gauge — 270° arc, zone-colored, mono readout. */
export function Gauge({ value, max, label, format, zones, term, unit, size = 92 }: GaugeProps) {
  const r = size / 2 - 9;
  const cx = size / 2;
  const cy = size / 2;
  const START = -135;
  const SWEEP = 270;
  const frac = clamp(max > 0 ? value / max : 0, 0, 1);
  const zone = zones.find((z) => frac <= z.upTo) ?? { color: "var(--c-cyan)", rgb: "34,211,238" };
  const arc = (fromFrac: number, toFrac: number): string => {
    const a0 = START + SWEEP * fromFrac;
    const a1 = START + SWEEP * toFrac;
    const [x0, y0] = pol(cx, cy, r, a0 + 90);
    const [x1, y1] = pol(cx, cy, r, a1 + 90);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };
  const [tipX, tipY] = pol(cx, cy, r, START + SWEEP * frac + 90);
  return (
    <div className="gauge">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <path d={arc(0, 1)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" strokeLinecap="round" />
        <path
          d={arc(0, frac)}
          fill="none"
          stroke={zone.color}
          strokeWidth="6"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px rgba(${zone.rgb},0.6))`, transition: "stroke 300ms linear" }}
        />
        <circle cx={tipX} cy={tipY} r="3.5" fill="#fff" style={{ filter: `drop-shadow(0 0 5px rgba(${zone.rgb},0.9))` }} />
      </svg>
      <div className="gauge-readout">
        <span className="gauge-val ds-num" style={{ color: zone.color }}>
          {format(value)}
        </span>
        {unit ? <span className="gauge-unit">{unit}</span> : null}
      </div>
      <div className="gauge-label ds-label">{term ? <InfoTooltip term={term}>{label}</InfoTooltip> : label}</div>
    </div>
  );
}

interface SparklineProps {
  data: number[];
  color?: string;
  rgb?: string;
  w?: number;
  h?: number;
}

/** Normalized trace with a soft area fill and a glowing head. */
export function Sparkline({ data, color = "var(--c-cyan)", rgb = "34,211,238", w = 172, h = 34 }: SparklineProps) {
  const id = useId().replace(/:/g, "");
  if (!data || data.length < 2) return <svg width={w} height={h} className="spark" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts: Pt[] = data.map((v, i) => [(i / (data.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 8)]);
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `${pts[0][0]},${h} ${line} ${pts[pts.length - 1][0]},${h}`;
  const head = pts[pts.length - 1];
  return (
    <svg width={w} height={h} className="spark">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`rgba(${rgb},0.28)`} />
          <stop offset="100%" stopColor={`rgba(${rgb},0)`} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={head[0]} cy={head[1]} r="2.6" fill={color} style={{ filter: `drop-shadow(0 0 4px rgba(${rgb},0.9))` }} />
    </svg>
  );
}

interface WaveformProps {
  data: number[];
  capacity: number;
  w?: number;
  h?: number;
}

/** Incoming demand (req/s) as a pulsing bar field; bars above the capacity line glow magenta. */
export function Waveform({ data, capacity, w = 100, h = 46 }: WaveformProps) {
  if (!data || !data.length) return null;
  const max = Math.max(capacity * 1.1, ...data, 1);
  const n = data.length;
  const bw = w / n;
  const capY = h - (capacity / max) * h;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="waveform" style={{ width: "100%", height: h }}>
      {capacity > 0 && (
        <line x1="0" x2={w} y1={capY} y2={capY} stroke="rgba(96,165,250,0.5)" strokeWidth="0.6" strokeDasharray="2 2" />
      )}
      {data.map((v, i) => {
        const over = v > capacity;
        const bh = (v / max) * h;
        const last = i === n - 1;
        return (
          <rect
            key={i}
            x={i * bw + bw * 0.18}
            y={h - bh}
            width={bw * 0.64}
            height={bh}
            rx={bw * 0.18}
            fill={over ? "var(--c-magenta)" : "var(--c-cyan)"}
            opacity={last ? 1 : 0.32 + 0.5 * (i / n)}
            className={last ? "wave-live" : ""}
          />
        );
      })}
    </svg>
  );
}
