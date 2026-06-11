// Level-up ceremony: watch the operator level derived from reputation; when it rises (after
// mount), show a centered banner with the badge burst and the REAL unlock list for that level,
// then auto-dismiss. Pure presentation — reputation/levels live in game/level.ts.

import { useEffect, useRef, useState } from "react";

import { sfx } from "../../../game/audio";
import { levelFromRep, unlocksAtLevel } from "../../../game/level";
import { IconHex, IconStar } from "./icons";

interface Celebration {
  level: number;
  unlocks: string[];
}

export function useLevelUp(reputation: number): { celebration: Celebration | null; dismiss: () => void } {
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const prev = useRef<number | null>(null);

  useEffect(() => {
    const level = levelFromRep(reputation);
    if (prev.current !== null && level > prev.current) {
      setCelebration({ level, unlocks: unlocksAtLevel(level) });
      sfx.unlock();
    }
    prev.current = level;
  }, [reputation]);

  useEffect(() => {
    if (!celebration) return;
    const t = window.setTimeout(() => setCelebration(null), 5200);
    return () => clearTimeout(t);
  }, [celebration]);

  return { celebration, dismiss: () => setCelebration(null) };
}

export function LevelUpBanner({ celebration, dismiss }: { celebration: Celebration | null; dismiss: () => void }) {
  if (!celebration) return null;
  return (
    <div className="lvlup" onClick={dismiss} role="status">
      <div className="lvlup-burst" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="lvlup-ray" style={{ transform: `rotate(${i * 45}deg)` }} />
        ))}
        <span className="lvlup-hex">
          <IconHex size={34} />
        </span>
        <span className="lvlup-num ds-num">{celebration.level}</span>
      </div>
      <div className="lvlup-title">OPERATOR LEVEL {celebration.level}</div>
      {celebration.unlocks.length > 0 && (
        <div className="lvlup-unlocks">
          {celebration.unlocks.map((u) => (
            <span key={u} className="lvlup-unlock">
              <span className="is-accent">
                <IconStar size={11} />
              </span>
              {u}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
