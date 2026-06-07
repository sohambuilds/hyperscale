// Procedural sound via the Web Audio API — no asset files. A lazy AudioContext (created on the
// first user gesture so autoplay policy is satisfied), a few synthesized SFX, and a low ambient
// server-room hum. All no-ops when muted or unavailable.

type WindowAudio = typeof window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let muted = false;
let humDesired = false;
let humNodes: { o: OscillatorNode; g: GainNode }[] = [];

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as WindowAudio).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneOpts {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  delay?: number;
}

function tone({ freq, dur, type = "sine", gain = 0.18, slideTo, delay = 0 }: ToneOpts): void {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

export const sfx = {
  place: () => tone({ freq: 240, dur: 0.09, type: "square", gain: 0.12, slideTo: 150 }),
  install: () => {
    tone({ freq: 330, dur: 0.06, type: "triangle", gain: 0.12 });
    tone({ freq: 540, dur: 0.09, type: "triangle", gain: 0.1, delay: 0.05 });
  },
  cash: () => {
    tone({ freq: 880, dur: 0.07, type: "sine", gain: 0.12 });
    tone({ freq: 1320, dur: 0.11, type: "sine", gain: 0.1, delay: 0.06 });
  },
  breach: () => tone({ freq: 210, dur: 0.28, type: "sawtooth", gain: 0.13, slideTo: 110 }),
  unlock: () => [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.13, type: "triangle", gain: 0.12, delay: i * 0.07 })),
  win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ freq: f, dur: 0.2, type: "sine", gain: 0.13, delay: i * 0.1 })),
  error: () => tone({ freq: 150, dur: 0.12, type: "square", gain: 0.08 }),
  click: () => tone({ freq: 420, dur: 0.04, type: "square", gain: 0.06 }),
};

export function startHum(): void {
  humDesired = true;
  const c = ac();
  if (!c || muted || humNodes.length) return;
  for (const [i, f] of [55, 110, 165].entries()) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.value = i === 0 ? 0.025 : 0.012;
    o.connect(g).connect(c.destination);
    o.start();
    humNodes.push({ o, g });
  }
}

export function stopHum(): void {
  humDesired = false;
  for (const n of humNodes) {
    try {
      n.o.stop();
    } catch {
      /* already stopped */
    }
  }
  humNodes = [];
}

export function setMuted(m: boolean): void {
  muted = m;
  if (m) {
    const keep = humDesired;
    stopHum();
    humDesired = keep;
  } else if (humDesired) {
    startHum();
  }
}
