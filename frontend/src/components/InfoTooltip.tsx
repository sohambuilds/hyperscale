import type { ReactNode } from "react";

import { GLOSSARY } from "../glossary";

interface InfoTooltipProps {
  term: string; // a key in GLOSSARY
  children?: ReactNode; // the label to annotate; defaults to the glossary term name
  color?: string; // optional accent for the label (e.g. a triangle-corner hue)
}

/**
 * Wraps a label with a hoverable/focusable "?" that reveals the glossary card:
 * the term's name as a header plus its one-sentence, beginner-facing definition.
 * Teaching is always one hover away — the system's "teach on hover" principle.
 */
export function InfoTooltip({ term, children, color }: InfoTooltipProps) {
  const entry = GLOSSARY[term];
  const label = children ?? entry?.term ?? term;
  if (!entry) return <span>{label}</span>;
  return (
    <span className="info" tabIndex={0}>
      <span className="info-label" style={color ? { color } : undefined}>
        {label}
      </span>
      <i className="info-mark" aria-hidden="true">
        ?
      </i>
      <span className="info-tip" role="tooltip">
        <strong className="info-tip-h">{entry.term}</strong>
        <span className="info-tip-b">{entry.short}</span>
      </span>
    </span>
  );
}
