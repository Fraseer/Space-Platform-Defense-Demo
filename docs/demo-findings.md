# Web demo findings: Act 1 prototype

> Handoff from the browser prototype (built in Claude Code) back to the design
> project. Add this file to the Claude project's knowledge next to `DESIGN.md`.
>
> - Play: https://fraseer.github.io/Space-Platform-Defense-Demo/
> - Code: https://github.com/Fraseer/Space-Platform-Defense-Demo (branch `claude/game-demo-web-prototype-r02fep`)
> - Status tags follow DESIGN.md. Nothing here is **[Decided]**: everything the
>   demo settled is **[Proposed]** until Fraser confirms it.
> - Where a finding comes from: **(playtest)** = Fraser playing the demo;
>   **(bot)** = the balance bot (40 seeds, greedy, holds the bridge);
>   **(build)** = a choice made while building, not yet tested by play.

## 1. What the demo is

Act 1 only: the command deck, from wake-up to the Siege Breacher. 2D top-down
SVG grid, placeholder shapes (cyan drones, orange invaders, near-black
background). One run is about 22–23 rounds, roughly 15–20 minutes.

In: XCOM-style turns, 2 drone types, 3 invader types plus the boss, ~12 cards,
power upkeep, matter, darkness and blips, three telegraphed breaches, capture
tech, win/lose. Out: everything else in DESIGN.md (other decks, lifts,
command posts, shop, events, procgen, factions, meta-progression).

## 2. Playtest findings so far

- **(playtest) "It plays well."** The core loop held up on first play.
- **(playtest) Invaders reached the bridge in 2 turns, which was too fast,** and
  there were straight routes from the outer ring to the centre. Fixed with
  staggered gates (§3.1): Runners now need 3–4 turns, Saboteurs 4–5, Brutes 5–6.
- **(bot) Turtling on the bridge is strong.** A bot that parks everything on
  the bridge, overwatches and shoots wins about 75% of runs. That pulls against
  the "greed vs safety" pillar; see open questions (§6).
- **(bot) A kept hand clogs.** With "draw up to 5, keep unplayed cards",
  situational cards (Vent Section, Scan, Kill the Lights) sat in hand forever
  and new cards stopped arriving. One free scrap per turn fixed it. Together
  with a second Fabricate Sentry card, it was the biggest balance change of
  the build (bot win rate went from 0/20 to 17/20).
- **(bot) Doing nothing loses at rounds 13–16** on the current map, so the
  threat is real.
- **(build) Hand-made maps break easily.** The first map had four doors that
  opened onto crates, a relay or nothing, and a room cut in two by its own
  furniture. Map tests now catch this. Procgen will need the same checks.

## 3. Design choices the demo made [Proposed]

### 3.1 Deck layout (DESIGN §3b)
- 25×25 tile grid, walls as tiles. Four rings: **hull rooms** (airlocks
  A/B/C) → **systems ring** (fabricator, generator, 3 lighting relays) →
  **inner ring corridor** → **bridge** (3×3 around the AI core).
- **Staggered gates, castle-style (playtest-driven):** hull → systems only at
  the four corners; systems → inner corridor only through the west and east
  relay rooms; inner corridor → bridge only north and south. Every ring is a
  loop, so there are flanking routes, but never a straight run to the centre.
  The old radial corridors became passages inside the systems ring.
- Walking distance airlock → bridge: A 27, B 33, C 25 steps (was 13/19/19).
- Proposed procgen constraints, carried over from the demo's map tests:
  1. no dead doors;
  2. doors only join neighbouring rings;
  3. gates between rings are offset;
  4. the fastest invader needs at least 3 turns from any airlock;
  5. airlock distances within 8 steps of each other.
- Side effect: your own reinforcements are slower too. The fabricator is 16
  steps from the bridge, so a new drone takes 2 turns to get there.
  That's more greed-vs-safety tension.

### 3.2 Turns and actions (DESIGN §3)
- 2 AP per drone. A move within range costs 1 AP; a dash (up to 2× range)
  costs 2 AP. **Shooting ends the drone's activation** (XCOM rule), so
  Overclock is what enables move-move-shoot.
- Auto-overwatch only for drones you **didn't touch at all**; a manual
  Overwatch action covers drones that moved once.
- Movement is 4-directional (Into the Breach style): clearer ranges.

### 3.3 Combat (DESIGN §5)
- Hit chance = aim − 5% per tile past optimal range − cover (half 20,
  full 40) + bonuses, clamped 5–95%, shown as a breakdown before firing.
- Cover is directional (walls, crates, systems and sealed doors on the
  target's side facing the shooter). No cover facing the shooter = flanked,
  +1 damage.
- A miss is a **graze for half damage, rounded up**. It works: no "95% and
  missed" moments.
- Overwatch: one reaction shot at −15 aim the first time an invader moves into
  sight and range; a kill stops the invader mid-move.

### 3.4 Power and matter (DESIGN §6)
- Power refills to income − upkeep (1 per drone). **Brownout**: if upkeep
  exceeds income, the newest drones start the turn with 1 AP. No hard cap.
- Matter (name used in the demo) comes from Worker salvage spots (2 uses,
  4 each), kills (2–4) and recycling. It pays for fabricating (Sentry 8,
  Worker 5), repairs (generator 6, relay 4) and Field Repair.

### 3.5 Cards (DESIGN §4)
- Draw up to 5 and keep unplayed cards, plus **one free scrap per turn**
  (right-click).
- The 12 cards worked as data-driven effects. Vent Section: rooms only (not
  corridors or the bridge), removed from the deck after one use, doesn't
  affect the boss, and vented invaders drop no matter. Emergency Bulkhead
  seals a door for 3 rounds and counts as full cover.

### 3.6 Darkness (DESIGN §7)
- Rooms are dark until a Worker repairs the relay that lights them; the
  bridge and fabrication bay start lit. Kill the Lights forces a zone dark for
  2 rounds.
- The ship sees every lit tile, everything inside a drone's sensor radius
  (with line of sight), and active Scans. Every other invader is a
  **motion-tracker blip**: position always known, never type, HP or intent.
  This keeps the "never hide what you need to avoid an unfair loss" rule.
- Invaders in the dark see only 3 tiles and lose 25 aim.
- **The AI only plans around drones it can see from where it starts its
  turn**, so in the dark it blunders into you. That's the "monster in their
  horror movie" feel.
- Resulting trade-off: lighting a room lets you see, but lets them aim. Kill
  the Lights plays on exactly this.

### 3.7 Invaders and AI (DESIGN §8)
- Runner: fast and fragile, beelines for the bridge. Brute: tank, hunts
  drones it can see. Saboteur: breaks systems you repaired, otherwise heads
  for the bridge.
- The AI scores every reachable tile on progress to its goal, cover, best
  shot, flanking and exposure, with weights per type. **No dice in decisions**,
  so the tactical overlay shows exactly what each visible invader will do.
- Each invader on a bridge tile drains bridge integrity (24) at the end of the
  enemy turn: Runner 2, Brute 1, Saboteur 1, Breacher 5.
- Breaches arrive at rounds 4, 8 and 12 (2, 3 and 5 invaders), each warned 3
  turns ahead. The boss is warned at round 13 and docks at round 17.

### 3.8 Boss: Siege Breacher (DESIGN §3b Acts)
- "Stop the drill" = a **Drill Rig** anchored at the airlock it docked at.
  Destroy the rig (14 HP) or kill/disable the Breacher (36 HP) to win. The
  aim is a greed-vs-safety choice at the climax: send a strike team out, or
  hold the bridge.
- It drills 2 tiles per turn straight at the bridge, **ignoring the maze**
  (walls, cover and doors become rubble), so it punishes turtling.
- Boss units are never blips and the drill route is always drawn.

### 3.9 Capturing tech (DESIGN §6)
- Disable Shot → the next lethal shot leaves a husk → a Worker hauls it
  (−2 move) to the fabricator → choose 1 of 3 module cards for that invader
  type → play it on a drone to install it permanently.
- Module pools used:
  - **Runner:** Servo Legs (+2 move), Reflex Loop (no overwatch penalty),
    Featherweight Frame (−1 upkeep, −2 HP).
  - **Brute:** Ablative Plating (+4 HP), Hardened Shell (−1 damage taken),
    Siege Cannon (+2 damage, −1 move).
  - **Saboteur:** Signal Jammer (−15 aim to nearby invaders), Optic Spike
    (+3 sensor), Remote Uplink (repair and salvage like a Worker).
  - **Breacher:** Plasma Cutter. Only reachable by disabling the boss, which
    ends the act, so in act 1 it only appears on the victory screen.

### 3.10 Visuals (DESIGN §9, colour-coding question)
- Cold cyan for the ship and drones, warm orange for invaders, near-black
  background. It reads well even with placeholder shapes.
- Map icons are standalone SVGs drawn in a single colour (fabricator,
  generator, relay, AI core, airlock, husk, warning). They are reusable in
  Godot, and as a starting point for the partner's icon set.

## 4. Numbers that worked (starting points, all in `src/sim/config.ts`)

| | Value |
|---|---|
| Power | base income 6, generator +2, upkeep 1 per drone |
| Matter | start 10; Sentry 8, Worker 5 |
| Sentry | 8 HP, move 4, aim 75, dmg 4, range 6/10, sensor 5 |
| Worker | 6 HP, move 5, aim 55, dmg 2, range 4/7, sensor 4 |
| Runner | 4 HP, move 5, aim 55, dmg 2 |
| Brute | 12 HP, move 3, aim 65, dmg 4 |
| Saboteur | 6 HP, move 4, aim 60, dmg 3 |
| Bridge integrity | 24 |
| Starting deck | 17 cards (2× Fabricate Sentry, 2× Overclock, 2× Uplink, 2× Reroute, 2× Disable Shot, singles of the rest) |
| Bot results | 75% wins, ~22.6 rounds (same bot on the old map: 88%) |

## 5. Architecture lessons for the Godot build (DESIGN §10)

- The **simulation/presentation split** (state + commands → reducer →
  events → view) was worth it. It enabled seeded replays, 80 rule tests, a
  headless balance bot, and an exact enemy-intent overlay, all for free.
  Recommend keeping it in Godot as DESIGN §10 leans.
- **Fog of war belongs in the simulation**, not the view: move events carry
  per-step visibility, so the view can't leak hidden invaders.
- **Content as data + one config file** made balance passes fast. A greedy bot
  over 40 seeds (`npm run balance`) was enough to catch big problems like the
  clogged hand.
- **Maps as ASCII plus zone rectangles tagged with their ring** was quick to
  edit and easy to validate with tests.

## 6. Open questions for the design chat

1. **Turtling.** The bridge plus overwatch is strong. Options: make the boss or
   Saboteurs punish it harder; reward exploration more (salvage, relays,
   capture); give the bridge fewer safe tiles; add a Stalker or Hacker in act 1.
2. **Hand rule.** Keep "keep hand + 1 free scrap", or move to Slay-the-Spire
   style (discard the hand each turn)? It's one config flag either way.
3. **Runner speed.** 5 (3–4 turns to the bridge, clearly the fastest) or 4
   (4–5 turns, same as Saboteurs)?
4. **Lighting trade-off.** Is "light helps you see but also helps them aim"
   the intended feel, or should relays be pure upside?
5. **Plasma Cutter in act 1.** Add a regular (non-boss) Breacher to act 1 so
   the cutter can be captured mid-act, or keep it as a later-act reward?
6. **Bridge integrity.** Should it ever regenerate (e.g. Worker repair)?
7. **Map size for procgen.** 25×25 with four staggered rings felt right. Keep
   it as the target size for generated decks?

## 7. Suggested DESIGN.md updates (for Fraser to confirm)

- §3b Deck layout: add the staggered-gate rule and the procgen constraints
  from §3.1 above.
- §3 Turns: shooting ends activation; auto-overwatch only for untouched
  drones; dash = 2 AP.
- §4 Cards: hand rule + one free scrap per turn.
- §5 Drones / §6 Resources: brownout rule; graze = half damage rounded up.
- §7 Darkness: blips show position only; invaders plan only around drones
  they can see; light helps both sides.
- §8 Invaders: the scoring weights approach worked; deterministic AI makes
  intent previews exact.
- §3b Acts / bosses: Drill Rig as "the goal"; drill ignores the maze.
- §14 Open questions: Matter name used in play; cyan/orange colour coding
  tested.
