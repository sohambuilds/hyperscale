# UPDATE 1 — Game-grade UI & More Stuff

> **Goal:** close the gap between "impressive tech demo" and "game you'd play on purpose."
> Two thrusts: (A) a **Top Farm-grade game UI** — chips, cards, levels, quests, celebrations —
> translated into our dark-neon server-room aesthetic, and (B) **more stuff** — content systems
> that deepen the capacity-planning economy (expansion, hazards, network, model tiers) plus a
> living world layer on the canvas renderer.
>
> Grounded in the current code: the canvas world engine (`frontend/src/components/tycoon/` —
> scene pipeline, AnimTracker, FxSystem, palette/projection, per-kind sprites) and the pure
> economy (`frontend/src/game/engine.ts` `computeStats`/`tick`). Supersedes nothing; this is the
> concrete build plan for BUILDER.md's P1/P2 with the UI thesis made explicit.
> All numbers indicative — tune in play.

---

## 0. The one-line thesis

**Dashboard-grade UI tells you numbers; game-grade UI makes you feel them.** Top Farm never
shows a "meter strip" — it shows a coin chip that *fills*, a level badge that *bursts*, a quest
that *ticks off*, a building that *arrives on a truck*. Every system below is the same data we
already compute, re-presented as objects, ceremonies, and rewards.

Hard rules carried forward: dark near-black base, neon state accents, mono for every number,
**no emoji** (procedural SVG/canvas icons only), five-meters-max discipline, no dark patterns
(no pay timers, no gacha), `prefers-reduced-motion` respected everywhere.

---

## A. GAME UI — the Top Farm anatomy, translated

### A1. HUD reshape: from strips to chips ★must

Today: a wide top bar + a 4-meter strip — reads as telemetry. Target: **floating corner
clusters** over the world, like every casual builder:

```
┌────────────────────────────────────────────────────────────────┐
│ [◆ Lv 7 ▓▓▓░]  [$ 24,580 ▲$310/min]          [⚡][❄][⇅] [🜲 2/3]│  ← left: identity+cash · right: utilities mini-gauges + contracts chip
│                                                                 │
│                    ( the world, full bleed )                    │
│                                                                 │
│ [quests ▣2]                                   [⏸ 1× 2× 4×] [⚙] │  ← left: quest tray · right: transport
│ ┌─────────────────────────────────────────────┐                 │
│ │  POWER   COOLING   RACK   NETWORK   SELL    │   ← build dock  │
│ └─────────────────────────────────────────────┘                 │
└────────────────────────────────────────────────────────────────┘
```
(glyphs above are placeholders — we draw our own icons, see A6)

- **Cash chip** — pill with a procedural coin-stack icon, mono count-up (already have
  `useAnimatedNumber`), and **fly-to-counter motes**: when revenue lands, 2-3 cyan-green motes
  fly from the serving rack (world space) to the chip (screen space) and the chip *pops* (1.0→
  1.06→1.0). The FxSystem already draws world motes; add a screen-space leg.
- **Utility mini-gauges** — power/cooling/network as three tiny radial rings (used/cap) instead
  of bars-with-text; tap one to expand a detail flyout. Red ring = the bottleneck. This keeps
  the 5-meter discipline but reads at a glance like a game resource, not a chart.
- **Contracts chip** — `n on-track / n total` with the worst status as the chip color; pulses
  when an offer lands (exists) or an SLA turns at-risk (new).
- Meter strip is retired as a permanent fixture; its detail moves into tap-flyouts.

### A2. Operator Level — XP makes progress visible ★must

Reputation already gates everything but is shown as a bare decimal. Recast it as a **Level
badge** (◆ hex badge, radial XP ring, `Lv N` in mono):

- **XP sources:** requests served (trickle), contract signed (+), contract completed on-track
  (++), tech researched (++), quest done (+++). Internally `xp` maps to the existing
  `reputation` thresholds (`minRep` fields) — one source of truth, new presentation.
- **Level-up ceremony:** time-stop 600ms, badge bursts (radial lines + ring shockwave, canvas
  confetti in palette colors — *not* rainbow), banner: "OPERATOR LEVEL 5 — H200 servers and
  Premium API contracts unlocked", with the actual unlock cards shown. Unlocks finally feel
  *given*, not discovered in a locked dropdown.
- Level replaces "reputation N" copy everywhere (offers: "Unlocks at Level 5").

### A3. Quest tray — direction after the tutorial ★must

The single biggest "what do I do now" fix. A goal chain of ~15 sequenced quests, 1-3 active,
in a slide-out tray (badge shows count of claimable rewards):

| # | Quest (examples) | Reward |
|---|---|---|
| 1 | Serve your first 100 requests | $800 + XP |
| 2 | Sign a strict-SLA contract and hold it on-track for 60s | $1,200 + XP |
| 3 | Run a latency rack AND a throughput rack at once | $1,500 + XP |
| 4 | Research any technique | $1,000 + XP |
| 5 | Hit 300 req/s served | $2,000 + XP |
| 6 | Buy your first expansion parcel | $2,500 + XP |
| 7 | Survive a heat wave with zero churn | $4,000 + XP |
| … | …through "win without ever breaching Premium API" | … |

- Quests are **detected, not clicked** (state predicates like the tutorial steps); the tray
  shows progress bars; completion = toast + tray badge; player taps to **claim** (the one
  satisfying click casual games keep).
- Implementation: `game/quests.ts` — `QUESTS: {id, copy, test(s), progress(s), reward}` + a
  `claimQuest` action; persists in the save.

### A4. Build dock as cards ★must

Replace the text-button palette with **cards**: 44-56px tiles, procedural icon, name, mono
cost, hover = lift + glow, active = pressed-in + cyan ring, unaffordable = desaturated with
the *missing amount* shown, locked (network tier 2, future placeables) = dark card + lock +
"Lv N". Keyboard numbers (exists) get tiny `1-5` hints. One-line contextual hint under the
dock while a tool is armed ("click a floor tile — right-click to cancel", exists as ticker).

### A5. Ceremonies — reward the spend, celebrate the win ★should

- **Offer cards** slide in with a soft chime + countdown ring (pairs with limited-time
  contracts, B7). Signing = stamp animation ("SIGNED" diagonal stamp in cyan) + the contract
  flying to the contracts chip.
- **Contract completed** (term contracts): star-burst on the chip + payout count-up.
- **Research completed:** "TECH ONLINE — Continuous batching" banner with one-line effect, and
  the relevant capacity ring visibly jumps (tween the cap line so the gain is *seen*).
- **Win/lose screens** (exist) get the same treatment: win = the whole facility's LEDs do a
  wave + confetti; lose = lights shut down row by row (brutal, memorable, cheap to draw).

### A6. Icon set ★must

~12 procedural icons (inline SVG components, stroke-based, 1.5px, on-palette): bolt (power),
fan (cooling), rack, switch/uplink (network), flask (research), scroll (contracts), coin-stack
(cash), hex-badge (level), target (quests), gauge, lock, star. One file
`components/tycoon/hud/icons.tsx`. This kills the remaining emoji/text glyphs (`⛶`, `✕`, `?`)
and is the visual glue for A1-A5.

---

## B. MORE STUFF — content systems (each deepens a decision, none adds a meter)

Priorities from the content research; "how" notes name exact code anchors.

### Must-haves (Update 1 core)

| # | Feature | The decision it creates | Key implementation anchors |
|---|---|---|---|
| B1 | **Floor expansion** — start 6×4, buy 3-4 parcels up to 10×7; locked parcels drawn dark with dashed cyan edge + mono price tag; tap → confirm-buy | Land vs capacity: a parcel ≈ a substation ≈ 5 H100s. Territory growth = the tycoon dopamine beat | `config.ts` `BASE_PLOT`+`EXPANSIONS`; `GameState.plots`; state-dependent `inBounds(s,…)`; `buyPlot` action; `sprites/floor.ts` dynamic rect; SAVE v4 migration grants 8×6 |
| B2 | **Hazard framework + 3 events** — warn phase (amber, 10-15t) → active (red): Heat wave (cooling ×0.7), Power-price surge (elec ×3), Flash crowd (all bursts fire + demand ×1.3). Rep-gated, never in tutorial, ≥90t spacing | Headroom becomes insurance; the warn window makes it counterplay (retune policy, shed a contract) not a tax | `HAZARDS[]` data-driven; `GameState.hazard`; multipliers applied inside `computeStats` (meters react for free); overlay reuses breach strain visuals; warning tone in `audio.ts` |
| B3 | **Network uplink (3rd utility)** — Leaf switch (150 req/s cap) → Spine (500); total served clamped by net capacity; **no 6th meter** — drawn as a cap-marker on the Serving ring | Contracts differ on req/s-vs-$/req: embeddings devours uplink at $0.01, reasoning sips it at $0.12. Completes the BUILDER.md dependency chain | `PlaceableKind+'network'`; `NETWORK_TIERS`; one extra `min()` in the serving waterfall; `sprites/network.ts` (half-height cabinet, blinking port LEDs, trunk line to wall); 5th dock card |
| B4 | **Model-tier contracts (8B / 70B)** — 5 premium archetypes tagged 70B; needs HBM ≥141 (H200/B200) *or* a full 4-GPU rack once Tensor parallelism is researched; amber `70B` chip on cards | Activates the dormant `hbm` stat and makes TP a *felt* unlock ("my H100 fleet can take 70B work" — the real vLLM tradeoff); sharpens the anti-linear fleet choice | `Contract.model`; `rackServes(rack, unlocked)` helper; one extra waterfall level in `computeStats` (two model sizes max — keep it hand-rolled, not an LP) |

### Should-haves (the insurance & churn layer — ship after/with hazards)

- **B5. UPS/battery (power tier 3)** — charge pool that substitutes during power events; the
  dedicated surge counterplay. Battery sprite shows a green charge bar *draining* live.
- **B6. GPU failure + repair → Predictive-maintenance tech** — rare failure weighted by tier
  age (prices A100's perf/$ edge honestly); repair = $ + ticks; the late efficiency tech
  auto-repairs — the anti-busywork valve.
- **B7. Limited-time surge contracts** — accept-countdown + fixed term + completion bonus iff
  on-track at term end. Forces portfolio refresh; pairs with the A5 offer ceremony.

### Later (deliberately deferred)

- Dynamic electricity day/night pricing (thin until a load-shifting lever exists);
- Second hall/region (render-scope trap; revisit as disaggregation's home in P3);
- Cosmetic deco tiles (win-gated, strictly zero-stat, separate `hyperscale.meta.v1` key).

---

## C. LIVING WORLD — the canvas layer (from the world-feel research)

### Must (highest feel-per-line)

| # | Feature | Why | Anchor |
|---|---|---|---|
| C1 | **Technician minifigs** — 2-5 tiny workers wander aisles, pause to "service" racks (cyan scan-line), hustle toward breaching racks | Human-scale motion = "staffed facility, not diagram"; diegetic urgency on breach | new `world/agents.ts` (FxSystem pattern); inject into the y-sorted entity pass |
| C2 | **Cable trays** — amber power traces + cyan network traces routed Manhattan-style along tile seams, junction dots, occasional bright pulse to serving racks | *Decoration that teaches* — the dependency chain becomes visible; kills the empty-board feel | new `world/cables.ts`; recompute on state change only; draw under entities |
| C3 | **Camera game-feel kit** — 250ms breach shake, 120ms placement punch-zoom, idle drift after 8s | Cheapest juice in the plan; consequence gets weight, purchases feel physical | all in `WorldCanvas.frame()` as transient offsets (never written into camRef) |
| C4 | **Delivery ceremony** — an AGV cart drives in on the existing service road, drops a strapped crate, building unpacks (existing born anim) | Money feels spent on *things*; justifies the apron/service road already drawn | extend `AnimTracker` with a DELIVERY phase before BORN; one cart, queue fast builds |

### Should

- **C5. Heat shimmer + cooling mist** tied to real rack load (thermo becomes *visible*);
- **C6. Ingress queue + packet tinting** — unserved demand piles up as shivering dots at the
  uplink; burst traffic arrives magenta; breached packets bounce off as red sparks (diegetic
  backpressure — the world says "under-provisioned" before any meter);
- **C7. Shift lighting cycle** — slow day/night mood scalar; night is the signature look,
  *earned* instead of constant;
- **C8. Scaffold build-in** (wireframe → rising body + weld sparks → boot flicker);
- **C9. Cached static floor pass** — walkway hazard stripes, tile labels (A1…), seeded grime/AO,
  blitted from an offscreen canvas (this *buys back* frame budget for C1-C8).

### Later
Wall blinkenlights + roof beacons; rare inspection-drone flyover; exterior rain on the apron
(rain-at-night is the jackpot screenshot).

---

## D. Release slices (each independently shippable)

| Slice | Contents | Outcome |
|---|---|---|
| **1A — Feel like a game** | A1 chips/HUD reshape, A2 level badge + ceremonies, A3 quest tray, A4 build-dock cards, A6 icons, C3 camera kit | Same systems, transformed presentation — the "is this a game?" question dies here |
| **1B — More world to build in** | B1 expansion, B3 network, C1 technicians, C2 cable trays, C4 delivery, C9 floor cache | The board gets bigger, the chain gets visible, the floor gets alive |
| **1C — Pressure & depth** | B2 hazards, B4 model tiers, B5 UPS, B6 failures, B7 surge contracts, C5/C6, A5 remaining ceremonies | The mid-game stops settling; insurance economics arrive |
| **1D — Mood** | C7 lighting cycle, C8 scaffold, polish pass + later items as appetite allows | Atmosphere & screenshot fuel |

Suggested order: **1A → 1B → 1C → 1D.** 1A first because every later feature lands better
inside a game-feeling shell (hazard warnings want the chip/ceremony language to exist).

---

## E. Engineering ground rules

1. **`computeStats` stays a pure function** of (state + hazard modifiers). All new systems
   (hazards, network, model tiers, battery) enter as inputs to it — the HUD reacts for free
   and the future sim_core swap (P3) stays clean.
2. **Save migration:** SAVE_KEY → v4 once (plots, hazard, xp, quests, network fields together);
   old saves get the full 8×6 plot granted. Meta-unlocks (cosmetics) live outside the run save.
3. **Perf budget:** canvas stays 60fps — particle caps (exist), no `shadowBlur` in loops,
   offscreen-cache the static floor (C9), skip ambient layers below zoom thresholds, and
   everything animated respects the existing `prefers-reduced-motion` flag.
4. **No new meters.** Network = cap marker; battery = bar on the sprite; hazards = tint +
   toast. The five-meter discipline held; keep holding it.
5. **No emoji; no rainbow.** Celebrations use palette colors; icons are ours (A6).
6. **Tutorial + quests share the predicate pattern** — the tutorial teaches the loop, quest
   chain takes over from there; both detected from state, never from clicks.
