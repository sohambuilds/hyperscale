import type { ReactNode } from "react";

// Shared instrument-panel primitives, ported from the design kit's ui-bits.
// Stroke-line, machined-corner controls that pick up state color from props.

interface SegOption<T> {
  value: T;
  label: ReactNode;
}

interface SegmentedProps<T extends string | number | boolean> {
  options: SegOption<T>[];
  value: T;
  onChange?: (value: T) => void;
  accent?: string;
  /** Display-only: reflects current state with no interaction (e.g. the sim fixes this knob). */
  readonly?: boolean;
}

/** Segmented control — used for Simple/Advanced and to reflect the current quant / TP. */
export function Segmented<T extends string | number | boolean>({
  options,
  value,
  onChange,
  accent = "var(--c-cyan)",
  readonly,
}: SegmentedProps<T>) {
  return (
    <div className={"seg" + (readonly ? " readonly" : "")} style={{ ["--seg-accent" as string]: accent }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={"seg-opt" + (o.value === value ? " on" : "")}
          disabled={readonly}
          aria-pressed={o.value === value}
          onClick={readonly ? undefined : () => onChange?.(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  suffix?: ReactNode;
  disabled?: boolean;
}

/** −/＋ stepper for an integer count (GPUs allocated). */
export function Stepper({ value, min = 0, max = 99, onChange, suffix, disabled }: StepperProps) {
  return (
    <div className="stepper">
      <button
        type="button"
        className="step-btn"
        aria-label="decrease"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span className="step-val ds-num">
        {value}
        {suffix != null && <span className="step-suffix">{suffix}</span>}
      </span>
      <button
        type="button"
        className="step-btn"
        aria-label="increase"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

interface DeltaProps {
  value: number | null | undefined;
  unit?: string;
  /** Whether an increase is good; if omitted, up is treated as good. */
  good?: boolean;
}

/** Small ▲/▼ delta chip with good/bad coloring — the live cause-and-effect cue. */
export function Delta({ value, unit, good }: DeltaProps) {
  if (value == null || Math.abs(value) < 0.01) return null;
  const up = value > 0;
  const positive = good === undefined ? up : good;
  const mag = Math.abs(value);
  const text = mag >= 1 ? Math.round(mag).toString() : mag.toFixed(2);
  return (
    <span className={"delta " + (positive ? "is-good" : "is-bad")}>
      {up ? "▲" : "▼"} {text}
      {unit}
    </span>
  );
}

interface IconBtnProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

/** Transport-style icon button (play / pause / step). */
export function IconBtn({ icon, label, active, disabled, onClick }: IconBtnProps) {
  return (
    <button
      type="button"
      className={"icon-btn" + (active ? " active" : "")}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
