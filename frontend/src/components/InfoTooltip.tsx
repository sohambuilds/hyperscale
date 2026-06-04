import type { ReactNode } from "react";

import { GLOSSARY } from "../glossary";

interface InfoTooltipProps {
  term: string; // a key in GLOSSARY
  children?: ReactNode; // the label to annotate; defaults to the glossary term name
}

/** Wraps a label with a hoverable/focusable "?" that reveals the glossary definition. */
export function InfoTooltip({ term, children }: InfoTooltipProps) {
  const entry = GLOSSARY[term];
  const label = children ?? entry?.term ?? term;
  const tip = entry?.short ?? "";
  return (
    <span className="info" tabIndex={0}>
      {label}
      <i className="info-mark" aria-hidden="true">
        ?
      </i>
      {tip && (
        <span className="info-tip" role="tooltip">
          {tip}
        </span>
      )}
    </span>
  );
}
