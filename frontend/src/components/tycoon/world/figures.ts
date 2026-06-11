// Shared little-human renderer used by the build crew and the ambient floor staff. A figure is a
// hard-hat + hi-vis-vest technician ~10px tall: alternating legs, a reflective-striped vest, a
// swinging back arm, a domed hard hat with a brim, and an optional held tool (hammer for builders,
// a glowing tablet for inspectors). All animation is wall-clock and silenced under reduced-motion.

import type { Palette } from "./palette";

/** A depth-sortable drawable (a person) — `y` is the feet anchor used to interleave with buildings
 *  so figures get occluded by cabinets they stand behind. `render` paints it at draw time. */
export interface Actor {
  y: number;
  render: (ctx: CanvasRenderingContext2D) => void;
}

export interface PersonStyle {
  hat: string;
  vest: string;
  skin: string;
  now: number;
  phase: number;
  walking: boolean;
  reduced: boolean;
  facing: number; // 1 = facing screen-right, -1 = left (which side the tool/brim leans)
  action: "hammer" | "inspect" | null;
}

/** Distinct datacenter-staff looks (hat + vest + skin), cycled by index for crowd variety. */
export function roleStyle(pal: Palette, i: number): { hat: string; vest: string; skin: string } {
  const ROLES = [
    { hat: "#eef1f8", vest: pal.amber, skin: "#e8c6a0" }, // white-hat supervisor
    { hat: pal.amber, vest: pal.cyan, skin: "#c9986b" }, // network tech
    { hat: pal.cyan, vest: pal.orange, skin: "#8d5a3c" }, // electrician
    { hat: pal.orange, vest: pal.gold, skin: "#e0b48a" }, // facilities
    { hat: "#eef1f8", vest: pal.orange, skin: "#a06b45" }, // ops
    { hat: pal.gold, vest: pal.cyan, skin: "#d8a878" }, // contractor
  ];
  return ROLES[((i % ROLES.length) + ROLES.length) % ROLES.length];
}

export function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, st: PersonStyle): void {
  const t = st.reduced ? 0 : st.now;
  const gait = st.walking ? Math.sin(t / 130 + st.phase) : 0;
  const bob = st.walking && !st.reduced ? Math.abs(Math.sin(t / 130 + st.phase)) * 0.6 : 0;
  const f = st.facing >= 0 ? 1 : -1;
  const fy = y; // feet baseline
  const cy = y - bob; // torso bobs

  // contact shadow
  ctx.save();
  ctx.translate(x, fy + 0.5);
  ctx.scale(1, 0.45);
  ctx.beginPath();
  ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.fill();
  ctx.restore();

  // legs — dark trousers, alternating stride
  ctx.strokeStyle = "#1c2740";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 0.8, cy - 3.1);
  ctx.lineTo(x - 0.8 + gait * 1.2, fy);
  ctx.moveTo(x + 0.8, cy - 3.1);
  ctx.lineTo(x + 0.8 - gait * 1.2, fy);
  ctx.stroke();

  // torso base (under the vest)
  ctx.fillStyle = "#222c44";
  ctx.beginPath();
  ctx.roundRect(x - 1.8, cy - 7.4, 3.6, 4.7, 1.2);
  ctx.fill();

  // back arm (swings opposite the front, drawn before the vest so it reads "behind")
  ctx.strokeStyle = "#222c44";
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - f * 1.5, cy - 6.5);
  ctx.lineTo(x - f * 2.1, cy - 4.3 - gait * 1.1);
  ctx.stroke();

  // hi-vis vest + reflective stripes
  ctx.fillStyle = st.vest;
  ctx.beginPath();
  ctx.roundRect(x - 1.7, cy - 6.7, 3.4, 3.8, 0.9);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillRect(x - 1.7, cy - 5.5, 3.4, 0.45);
  ctx.fillRect(x - 1.7, cy - 4.3, 3.4, 0.45);
  ctx.fillRect(x - 0.3, cy - 6.7, 0.6, 3.8);

  // front arm / held tool
  if (st.action === "hammer") {
    const swing = st.reduced ? 0 : Math.sin(t / 110 + st.phase);
    ctx.strokeStyle = "#9aa3b8";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(x + f * 1.4, cy - 5.6);
    ctx.lineTo(x + f * 2.7, cy - 6.7 - swing * 1.6);
    ctx.stroke();
    ctx.fillStyle = "#cfd6e6";
    ctx.fillRect(x + f * 2.2, cy - 7.5 - swing * 1.6, f * 1.7, 1.0);
    if (swing > 0.86) {
      ctx.fillStyle = "rgba(124,227,255,0.95)";
      ctx.fillRect(x + f * 3 + (Math.random() - 0.5) * 2, cy - 7 - Math.random() * 2, 1, 1);
    }
  } else if (st.action === "inspect") {
    // glowing tablet held in front at chest height
    const tx = f > 0 ? x + 1.1 : x - 3.1;
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(tx, cy - 6.1, 2.0, 2.6);
    const glow = 0.6 + 0.3 * Math.sin(t / 320 + st.phase);
    ctx.fillStyle = `rgba(124,227,255,${glow.toFixed(2)})`;
    ctx.fillRect(tx + 0.3, cy - 5.7, 1.4, 1.8);
    ctx.strokeStyle = "#222c44";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(x + f * 1.3, cy - 6.3);
    ctx.lineTo(tx + (f > 0 ? 0.2 : 1.8), cy - 5);
    ctx.stroke();
  } else {
    // free front arm, swings with the walk
    ctx.strokeStyle = st.vest;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + f * 1.5, cy - 6.5);
    ctx.lineTo(x + f * 2.1, cy - 4.3 + gait * 1.1);
    ctx.stroke();
  }

  // head
  ctx.fillStyle = st.skin;
  ctx.beginPath();
  ctx.arc(x, cy - 8.4, 1.4, 0, Math.PI * 2);
  ctx.fill();

  // hard hat: domed shell + forward brim + highlight + ridge
  ctx.fillStyle = st.hat;
  ctx.beginPath();
  ctx.arc(x, cy - 8.7, 1.75, Math.PI, Math.PI * 2); // top dome
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + f * 0.4, cy - 8.7, 2.15, 0.7, 0, 0, Math.PI * 2); // brim
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.ellipse(x - f * 0.5, cy - 9.4, 0.7, 0.5, 0, 0, Math.PI * 2); // shine
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(x, cy - 10.4);
  ctx.lineTo(x, cy - 8.9);
  ctx.stroke();
}
