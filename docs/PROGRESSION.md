# INFERENCE — Campaign & Progression Design

> **⚠️ Superseded as the core direction by [`BUILDER.md`](BUILDER.md).** The game is now a
> from-scratch **construction tycoon** (build power/cooling/racks/GPUs on the iso grid), not a
> triangle/dashboard campaign. The reusable parts below — unlock ladders, economy curve, save
> model, level/objective ideas — still apply, recentered on *building*. Kept for reference.

> **Status:** Design doc (no code yet). Proposes the progression layer that turns the M1
> vertical slice into a level-based tycoon game.
> **Builds on:** [`BUILD_PLAN.md`](BUILD_PLAN.md) (premise, M2 fidelity roadmap),
> [`FIDELITY.md`](FIDELITY.md) (honesty ledger), [`STEP_CONTRACT.md`](STEP_CONTRACT.md)
> (engine contract), and the Mission Control UI already shipped in `frontend/`.
> **All hardware/model/price numbers below are _indicative design targets_**, to be
> calibrated per the FIDELITY ethos — they set the *curve*, not the final constants.

---

## 1. Vision

Today INFERENCE is one scenario (a 10-minute traffic ramp) you play once and score. We're
turning it into a **progression-based, level-wise tycoon** — the *Top Farm / city-builder*
loop, translated to running LLM inference at scale:

- You **start small** (a couple of weak GPUs serving one small model) and **grow** into a
  hyperscaler (multi-region fleets serving frontier MoE models).
- You **beat discrete levels** (missions with objectives and a 1–3 star rating) that teach one
  idea at a time and **gate** the next.
- **Unlocks carry across the whole campaign** — every level won permanently adds models, GPU
  hardware, serving mechanics, and tougher scenarios to your toolbox and your home datacenter.
- The **hard triangle** — *latency SLOs ⟷ cost & power ⟷ incoming traffic* — stays the soul of
  every level. Progression just hands you more levers to balance it, and more pressure on it.

### The two references, translated

| Their genre | Their hook | Our equivalent |
|---|---|---|
| Top Farm | XP & player level, quests, soft currency (coins), unlocking crops/buildings, expanding the farm | Player level from objectives + tokens served; level objectives as quests; **coins = banked profit**; unlock models/GPUs/mechanics; expand your datacenter |
| City builder | Population milestones unlock zones & services; grow one persistent city | A persistent **home datacenter** ("Your Datacenter") you grow rack → hall → region across the campaign; milestones unlock the tech tree |

We marry both: a **campaign of levels** is the spine (discrete, star-rated, teaches + gates),
and a **persistent meta-layer** (player level, coins, unlocks, a growing home base) is the
city-builder progression that carries between levels.

---

## 2. Design pillars

1. **The triangle is always the point.** Every level is a different way to feel
   latency ⟷ cost ⟷ traffic pull against each other. New mechanics are new *ways to push a
   corner*, never busywork.
2. **Teach as you unlock (progressive disclosure).** A beginner never sees a wall of knobs.
   Each mechanic is introduced by exactly one level, with a glossary-backed "what is this?"
   card the first time it appears. The Simple/Advanced split already in the UI becomes the
   unlock gate.
3. **Honest sim (FIDELITY).** Unlocks are *real* engine features (they land on the M2 ladder),
   not cosmetic. A tooltip that says "≈2× throughput" reflects what the model actually does.
   Indicative numbers are flagged and calibrated, never faked.
4. **Juicy, legible feedback.** Stars, coins, unlock reveals, the triangle settling after a
   good move — the satisfying-systems feel. Failure is a clear, fair lesson ("queue exploded →
   you were under-provisioned"), never a mystery.
5. **One-more-level pull.** Short levels (3–8 min sim-time), clear objectives, a visible "next
   unlock", and optional star-chasing for replay.

---

## 3. Progression architecture (two interlocking layers)

```
            ┌─────────────────────────── META LAYER (persists) ───────────────────────────┐
            │  Player level + XP   •   Coins (soft currency)   •   Unlock tree (4 tracks)   │
            │  Home datacenter ("Your Datacenter")   •   Stars   •   Best scores / replays  │
            └───────────────▲───────────────────────────────────────────────▲──────────────┘
                            │ grants unlocks, XP, coins                       │ spend coins (shop) / stars (tree)
                            │                                                 │
   World Map ──► Level Briefing ──► PLAY (Mission Control HUD + objectives) ──► Results ──► Unlock reveal
     ▲                                                                                         │
     └─────────────────────────────────── back to map (next level unlocked) ◄─────────────────┘
```

**Per-level loop (seconds→minutes):** read briefing → press Play → balance the triangle as the
workload + hazards evolve → meet objectives → earn 1–3 stars → bank coins/XP → see what unlocked.

**Meta loop (sessions):** spend coins in the **shop** (buy/rent better GPUs, upgrade your home
datacenter), spend stars on **optional tech-tree branches**, level up, take the next contract,
and grow the persistent datacenter.

---

## 4. The four unlock tracks

Leveling unlocks across **all four** tracks. Each track answers a different question.

### 4.1 Models — *"what am I serving?"* (revenue & difficulty ladder)

Bigger models earn more per token but are harder to keep inside the SLO (more memory, more
compute, decode is bandwidth-bound). *Indicative:*

| Model | Params (active) | Memory weight | $/1M tok (indicative) | Why it's harder | Unlocks |
|---|---|---|---|---|---|
| `llama-8b` | 8B | low | $0.50 | baseline | start |
| `llama-70b` | 70B | high | $2.00 | won't fit/serve fast on one GPU → needs TP or big HBM | Act III |
| `llama-405b` | 405B | very high | $6.00 | needs multi-GPU TP+PP; KV pressure dominates | Act IV |
| `moe-235b` | 235B (22B active) | high mem / low compute | $4.00 | cheap compute but routing- & memory-sensitive | Act IV |

### 4.2 GPU hardware — *"what am I serving it on?"* (the shop spine)

Better perf-per-watt and capacity, at higher rent. The economy's main capex/opex lever.
*Indicative (calibrate vs real datasheets + FIDELITY):*

| GPU | HBM | Bandwidth | ~BF16 | Power | Rent/hr (indicative) | Unlocks |
|---|---|---|---|---|---|---|
| A100-40 | 40 GB | 1.55 TB/s | 0.31 PF | 400 W | $1.10 | start |
| A100-80 | 80 GB | 2.0 TB/s | 0.31 PF | 400 W | $1.50 | L2 |
| H100-80 | 80 GB | 3.35 TB/s | 0.99 PF | 700 W | $2.50 | Act II |
| H200-141 | 141 GB | 4.8 TB/s | 0.99 PF | 700 W | $3.50 | Act III |
| B200-192 | 192 GB | 8.0 TB/s | 2.2 PF | 1000 W | $6.00 | Act IV |
| GB200 NVL72 (rack) | pooled | very high | very high | rack-scale | leased as a unit | endgame / stretch |

> The current engine ships H100 only. The ladder is added as `GpuType` catalog entries; the
> campaign simply starts you lower (A100) so unlocking the H100 is an early, satisfying reward.

### 4.3 Serving mechanics — *"how do I serve it?"* (depth, unlocked one at a time)

These **are the M2 fidelity roadmap**, gated as rewards. Each is a real new control (extends the
`step()` action set) and visibly moves a triangle corner.

| Mechanic | What it does | Helps corner | Tradeoff | Unlocks |
|---|---|---|---|---|
| GPU scaling | add/remove GPUs (the M1 lever) | traffic, latency | rent + power ↑ (cost) | L1 |
| Batch tuning | bigger forward passes | traffic (throughput ↑) | latency tail ↑ | Act II |
| Quantization (FP8) | fewer bits → faster, less memory | cost, traffic | tiny quality ↓ | Act II |
| Quantization (INT4) | far fewer bits | cost, traffic | quality ↓ | Act II (late) |
| KV cache / paged attention | reuse attention state; pack memory | traffic (capacity ↑) | the baseline win; manage pressure | Act II |
| Prefix caching | skip prefill for shared prompts | latency, cost | workload-dependent | Act II/III |
| Tensor parallelism (TP) | split a model across GPUs | latency (fit big models) | needs NVLink; comm overhead | Act III |
| Pipeline parallelism (PP) | stage a model across GPUs | capacity (fit huge models) | pipeline-bubble latency | Act III |
| Autoscaling | auto-match GPUs to demand | cost, traffic | cold-start lag | Act III |
| Speculative decoding | draft model guesses tokens | latency (TPOT ↓) | draft cost; verify step | Act IV |
| Chunked prefill | interleave prefill with decode | latency (smoother tail) | minor overhead | Act IV |
| Request routing / SLA tiers | balance replicas; prioritize | latency, cost | policy complexity | Act IV |
| Multi-region | serve global demand near users | latency, traffic | capex; cross-region | Act IV |
| Disaggregated prefill/decode | specialized pools | latency, cost | orchestration complexity | endgame / stretch |

### 4.4 Scenario hazards — *"what's coming at me?"* (challenge & variety)

Workload shapes and shocks, introduced progressively. All are **seeded** so runs stay
deterministic and replayable.

| Hazard | Effect | Introduced |
|---|---|---|
| Gentle ramp | smooth 1×→N× demand | Act I |
| Diurnal cycle | day/night demand wave | Act II |
| Traffic spike / flash crowd | sudden 2–3× burst | Act II/III |
| GPU failure | a rack drops; lose capacity mid-run | Act III |
| Power-price surge | $/kWh spikes; cost pressure | Act III |
| Power cap / brownout | hard power budget tightened | Act III |
| SLA penalty tiers | breaches incur fines, not just lost revenue | Act IV |
| Regional latency | geo-distributed users; routing matters | Act IV |
| Viral event (boss) | sustained mega-demand, everything at once | Act IV finale |

---

## 5. The unlock tree

Unlocks come from two sources, so there's both a guaranteed path and optional depth:

- **Campaign completion (guaranteed spine).** Beating a level grants its headline unlock
  (a model, a GPU tier, a mechanic, or the next act). This guarantees everyone has the tools
  the next level assumes.
- **Stars (optional branches).** Stars are a currency spent in a small **tech tree** for
  *optional* upgrades that deepen mastery (e.g. "Better drafts: +draft model quality for spec
  decoding", "Warm pools: shorter autoscaler cold-start", "Bulk rent: −10% GPU rent",
  "Green DC: lower PUE"). Star branches never gate the campaign — they reward replay.

```
Act I  ──► Act II ──► Act III ──► Act IV ──► Endless
  │           │           │           │
  └ GPU scale └ quant/KV  └ TP/PP/    └ spec decode / routing /
              /batching     autoscale   multi-region / MoE+405B
  (each level's star surplus → optional tech-tree nodes: rent/PUE/cold-start/draft-quality/…)
```

---

## 6. Level anatomy (data schema)

Every level is a **Scenario** (the existing registry concept) enriched with progression
metadata. Proposed shape (engine-side dataclass; mirrored to the client in the init frame):

```
Level
  id            : str            # "a2-l5"
  act           : int            # 1..4
  title         : str            # "Bit by Bit"
  briefing      : str            # in-voice setup (see §11 copy rules)
  loadout       : Loadout        # starting cash, GPUs (type+count), models, power budget,
                                 #   PUE, prices, and which controls are AVAILABLE (gated by unlocks)
  workload      : WorkloadSchedule  # λ(t) shape + length distributions (existing WorkloadConfig)
  hazards       : list[Hazard]   # seeded events (spike@t, gpu_fail@t, price_surge@t, …)
  objectives    : Objectives     # primary + secondary + mastery (see §7)
  stars         : StarThresholds # the cut lines for ★ / ★★ / ★★★
  rewards       : Rewards        # headline unlock + coins + XP
  par           : ParStats       # designer's reference solve (for tuning/telemetry)
```

`scenarios/` becomes a folder of levels (or a small declarative table) instead of one `ramp.py`.
The current ramp becomes an early Act-I level almost verbatim.

---

## 7. Objectives & star scoring

### Objective types (composable per level)

| Type | Pass condition (example) | Teaches |
|---|---|---|
| Solvency | end with cash ≥ start (don't go bankrupt) | the cost corner |
| SLO uptime | mean SLO attainment ≥ 90% | the latency corner |
| Reliability | completed / (completed + churned) ≥ 95% | the traffic corner |
| Profit | profit ≥ $X | the whole loop |
| Efficiency | tokens per $ ≥ X (or tokens per W ≥ X) | quant / right-sizing |
| Peak handling | hold SLO ≥ 90% while demand ≥ N req/s | scaling under pressure |
| Survival | no bankruptcy AND no power-trip through a shock | hazard response |
| Speedrun | reach profit $X by sim-time T | aggressive optimization |
| No-churn | zero churned requests | provisioning discipline |

### Star rubric (generic; each level sets the numbers in `StarThresholds`)

- **★ Complete** — meet the **primary** objective (you "passed" — unlock granted).
- **★★ Strong** — also meet the **secondary** objective (usually profit or SLO).
- **★★★ Mastery** — also meet the **mastery** objective (efficiency / no-churn / under a cost or
  power cap). The "did it the elegant way" star.

### Scoring math (extends the existing `Score`)

The engine already computes `profit`, `mean_slo_attainment`, `reliability`,
`requests_completed/churned`, and `tokens_served`. Add two derived efficiency metrics:

```
tokens_per_dollar = tokens_served / max(total_cost, ε)
tokens_per_watt   = tokens_served / max(mean_power_w, ε)
```

A level's `StarThresholds` is just cut lines on these fields, e.g.:

```
★   : mean_slo_attainment ≥ 0.90 AND profit ≥ 0
★★  : ★ AND profit ≥ 5_000
★★★ : ★★ AND tokens_per_dollar ≥ 1.8e6 AND churn == 0
```

Keep a single normalized **0–100 level score** for leaderboards (weighted blend of
profit-vs-par, SLO, efficiency), but **stars are the player-facing currency**.

---

## 8. The campaign (16 levels, 4 acts)

Each act introduces a theme, ~4 levels, escalating pressure, and gates the next act behind a
star total. Demand/SLO/budget numbers are indicative starting points for tuning.

### Act I — Boot Camp *(learn the triangle; tutorialized)*

| # | Title | Introduces / lesson | Headline unlock | Primary ★ | ★★ / ★★★ |
|---|---|---|---|---|---|
| 1 | First Tokens | play/pause/speed; GPU scaling; read the triangle | — | finish solvent, SLO ≥ 85% | profit ≥ $2k / zero churn |
| 2 | Hold the Line | scale up *and back down* with the ramp | **A100-80 → H100** | SLO ≥ 90% through 4× ramp | profit ≥ $5k / no-churn |
| 3 | Mind the Meter | the cost corner: idle GPUs burn rent + power | power/efficiency readout | profit ≥ $3k under power cap | tokens/$ ≥ par / SLO ≥ 95% |
| 4 | Shakedown | combined gentle test; gates Act II | **Act II + Batching** | all three: solvent, SLO ≥ 90%, reliability ≥ 95% | profit / efficiency |

### Act II — Optimize *(do more with less)*

| # | Title | Introduces / lesson | Headline unlock | Primary ★ | ★★ / ★★★ |
|---|---|---|---|---|---|
| 5 | Bit by Bit | **Quantization (FP8)** — same demand, cheaper | FP8 | tokens/$ ≥ X | profit / quality kept ≥ 99% |
| 6 | Cache Rules | **KV/paged + prefix caching**; long-context load; KV pressure | prefix cache | SLO ≥ 90% with long prompts | no KV-driven churn |
| 7 | Crowd Surge | first **traffic spike**; absorb with batch + quant | — | survive spike, SLO ≥ 85% | profit through spike |
| 8 | Lean Machine | cost crunch (rent ↑, budget ↓); **INT4**; gates Act III | **INT4 + Act III** | profit ≥ $X under tight budget | tokens/W mastery |

### Act III — Scale Out *(more models, more machines, automate)*

| # | Title | Introduces / lesson | Headline unlock | Primary ★ | ★★ / ★★★ |
|---|---|---|---|---|---|
| 9 | Bigger Brains | **llama-70b + Tensor Parallelism** | 70B, TP | serve 70B at SLO ≥ 90% | profit / TPOT mastery |
| 10 | Auto-Pilot | **Autoscaling** (cold-start lag); diurnal demand | autoscaler | hold SLO across a full day cycle | cost vs always-on baseline |
| 11 | Lights Out | **GPU failure** hazard; resilience | (PP unlock) | reliability ≥ 95% through a failure | no SLA breach |
| 12 | Two Fronts | multi-instance / multi-model + **routing intro**; gates Act IV | **routing + Act IV** | both models meet SLO | profit / balanced load |

### Act IV — Hyperscale *(frontier scale, real shocks)*

| # | Title | Introduces / lesson | Headline unlock | Primary ★ | ★★ / ★★★ |
|---|---|---|---|---|---|
| 13 | Go Global | **Multi-region + routing**; regional latency | multi-region | meet geo-SLO in all regions | cost-efficient placement |
| 14 | Faster Words | **Speculative decoding**; tight TPOT SLA | spec decode | TPOT SLA met ≥ 95% | profit / draft-efficiency |
| 15 | Mixture | **MoE-235B / llama-405b**; **SLA penalty tiers** | 405B + MoE | no penalty-tier breaches | profit under fines |
| 16 | **Black Friday** (finale) | **viral event** — sustained mega-demand, all hazards | endless + prestige | survive solvent, SLO ≥ 85% | profit / efficiency = *legend* |

**Post-campaign:** unlock **Endless ("Your Datacenter")** — your persistent home base as an
open sandbox with escalating procedural demand and a high-score chase — plus **Prestige**
(reset for a permanent multiplier) and a hook into **M3 multiplayer** leaderboards.

---

## 9. Economy & difficulty curve

The campaign tightens the triangle act by act along five dials. Indicative targets:

| Act | Start cash | Peak demand | TTFT / TPOT SLO | Power budget | Hazards | GPU tier | Models |
|---|---|---|---|---|---|---|---|
| I | $50k | 50 → 300 req/s | 1.0 s / 50 ms | generous (12 kW) | ramp only | A100 → H100 | 8B |
| II | $40k | up to 600 req/s | 1.0 s / 50 ms | tighter (10 kW) | diurnal, spike | H100 | 8B |
| III | $60k | up to 2k req/s | 0.8 s / 40 ms | per-region | failure, price surge | H100 → H200 | 8B, 70B |
| IV | $100k | 5k+ req/s, global | 0.6 s / 30 ms | hard caps + fines | all + viral | H200 → B200 | 70B, 405B, MoE |

**Currencies & spend:**
- **Coins** = banked profit (carried over). Spent in the **shop** to rent GPUs, buy home-base
  upgrades, and pre-stage capacity for the next contract.
- **Stars** = mastery currency. Spent in the **tech tree** on optional efficiency upgrades
  (rent discount, lower PUE, shorter cold-start, better draft model, higher batch ceiling).
- **XP / player level** = from objectives met + tokens served; **gates which unlocks are
  available** and paces the reveal of complexity (the disclosure throttle).

**Difficulty comes from squeezing the triangle, not from fake walls:** more demand (traffic
corner), tighter SLO + bigger models (latency corner), tighter power/price + fines (cost
corner) — and hazards that hit a corner you weren't watching.

---

## 10. Meta-progression & persistence

**SaveState** (one profile; start client-side, schema designed to migrate to server accounts in
M3):

```
SaveState
  version        : int
  player         : { level, xp, coins }
  unlocked       : { gpus: [...], models: [...], mechanics: [...], acts: [...] }
  levels         : { [levelId]: { stars: 0..3, bestScore, beaten: bool, replayCount } }
  techTree       : { [nodeId]: bool }
  homeDatacenter : { racks, halls, regions, theme, placedHardware: [...] }
  settings       : { reducedMotion, … }
```

- **Where it lives:** Phase 0 stores `SaveState` in `localStorage` (fast to build, no accounts).
  The schema is deliberately serializable and authoritative-friendly so M3 can move it
  server-side behind a login without redesign — mirroring the same "pure core, thin shells"
  bet the engine already makes.
- **What persists:** unlocks, stars, best scores, the home datacenter, player level/coins.
- **What's per-attempt:** the live `ClusterState` of a level run (already seeded + serializable,
  so retries and replays are free).

**Home datacenter ("Your Datacenter").** The Datacenter floor screen already built becomes the
persistent home base: you expand it (rack → hall → region) as you progress, and it's the
sandbox for Endless mode. This is the city-builder anchor — a place that visibly *grows*.

---

## 11. Onboarding & tutorialization

- **Act I is the tutorial**, diegetically. No separate tutorial mode — L1–L4 each isolate one
  idea (the triangle, scaling timing, the cost corner, putting it together).
- **Gated disclosure.** A control appears only once its mechanic is unlocked. The existing
  **Simple/Advanced** toggle and the per-knob **glossary hover cards** are the delivery
  mechanism: unlocking a mechanic flips it on and shows a one-time "new tool" card with the
  plain-English explainer (canonical copy from `glossary.ts`).
- **Voice (from CONTENT FUNDAMENTALS):** briefings and tips talk like a knowledgeable friend at
  the next desk — plain-English first, term second; numbers with units; concrete and slightly
  opinionated; no emoji. Example briefing:
  > **Bit by Bit.** Same flood of requests as last shift, but the budget's been cut. Good news:
  > you can now **quantize** — store the model's weights in fewer bits (FP16 → FP8) for roughly
  > double the throughput and half the memory, at a sliver of quality. Serve the ramp for less.
  > *Goal: 1.2M tokens per dollar. Three stars: keep quality above 99%.*

---

## 12. Screens & UX (mostly reuse what's built)

| Screen | Role | Reuse |
|---|---|---|
| **World map / level select** | pick a contract; see stars, locks, the next unlock | new |
| **Level briefing** | setup, objectives, loadout, "what's new" | modal (toast/term styles) |
| **In-level HUD** | play the level | **Mission Control dashboard already built** + an objectives tracker overlay |
| **Pause menu** | resume / restart / abandon | small modal |
| **Results** | star reveal, score breakdown vs par, coins/XP | extend existing Results overlay |
| **Unlock reveal** | the dopamine beat — new model/GPU/mechanic | new (reuse toast/card styling) |
| **Tech tree** | spend stars on optional branches | new |
| **Shop** | spend coins on GPUs / home upgrades | new (reuse ServingConfig/spec-sheet styling) |
| **Your Datacenter** | persistent home base + Endless | **DatacenterFloor already built**, made persistent/expandable |

All of it inherits the design-system tokens, fonts, glow, and motion already in `styles.css`.

---

## 13. Mapping to the architecture & build phases

The "pure core, thin shells" bet makes this mostly additive. Nothing here breaks determinism.

**Engine (`sim_core`)** — extend, don't rewrite:
- Catalog: add `GpuType` / `ModelSpec` entries for the ladders (§4.1–4.2).
- Mechanics: implement M2 features (quant, TP/PP, autoscaling, spec decode, routing,
  multi-region) as real physics/economics + **new `Action` types** in `STEP_CONTRACT.md`, each
  logged in `FIDELITY.md`.
- Controls: extend `server/schemas.py` with the new control messages, exposed only when unlocked.
- Hazards: build out `events.py` (currently stubbed) as **seeded** injectors (spike, GPU fail,
  price surge) so replays stay deterministic.

**Scenarios → Levels:** replace the single `ramp` with a level registry carrying the §6 schema
(loadout, workload, hazards, objectives, star thresholds, rewards). The current ramp becomes an
Act-I level.

**Server:** evaluate objectives + compute stars + level result at run end; include `objectives`
and the *available* (unlock-gated) control set in the init frame. Save stays client-side in
Phase 0; add profile endpoints in M3.

**Frontend:** new screens (§12) + a progression store reading/writing `SaveState`; the
objectives tracker overlays the existing Mission Control HUD.

### Suggested phase order (when we start building)

- **P0 — Progression scaffolding.** Level data model + world map/level-select + objectives HUD +
  star scoring + `SaveState` (localStorage) + unlock-gated controls, wired onto the **existing
  ramp** plus 2–3 Act-I levels. *This is the skeleton everything else hangs on — recommended
  first build.*
- **P1 — Mechanics unlocks.** Land Act II/III mechanics (quant → KV → batching → TP/PP →
  autoscaling), each as a real engine feature + control + one-time teach card.
- **P2 — Hazards & events.** `events.py` injectors + Act III/IV hazard levels.
- **P3 — Home base & shop.** Persistent expandable datacenter + coins economy + tech tree.
- **P4 — Endless, prestige, leaderboards.** Sandbox + M3 multiplayer hook.

---

## 14. Open questions / risks / decisions

- **Difficulty tuning needs data.** Star thresholds and the economy curve must be playtested;
  bake in telemetry (record each run's score vs `par`) from P0 so we tune on real attempts.
- **Real-time vs think-time.** Keep pause/step; objectives evaluate on **sim-time**, so pausing
  to plan never cheats the score. (Consider a separate "no-pause" star for hardcore later.)
- **Determinism with hazards.** All events seeded and carried in state — a level is fully
  reproducible (free retries, replays, and future RL).
- **Indicative numbers.** GPU/model/price tables are design targets; calibrate against real
  serving benchmarks per `FIDELITY.md` before they're presented as authoritative.
- **Scope.** This is large — ship **act by act**. P0 + Act I is a complete, shippable loop;
  each later act is additive.
- **Save migration.** Client save now, accounts in M3 — schema is designed for that move.
- **Multiplayer interplay (M3).** Shared GPU market + customer pool already on the roadmap; the
  coins economy and home base are designed to extend into it.

---

## 15. Next step

Per the chosen direction (campaign + persistent unlocks; all four unlock tracks), the
recommended first build is **P0 — Progression scaffolding** (§13): the level data model, world
map, objectives + stars, and save, wired onto the existing ramp with the first 2–3 Act-I levels.
That turns the current one-shot sim into a playable, progressing campaign skeleton you can then
fill act by act.
