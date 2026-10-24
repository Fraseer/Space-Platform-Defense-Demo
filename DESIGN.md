# Space Platform Defense — Design Doc

> Single source of truth for the game. Lives in this Claude project's knowledge **and** in the Godot repo as `DESIGN.md`. When a decision changes in either place, update the doc.
>
> Status tags: **[Decided]** = Fraser has confirmed · **[Leaning]** = Fraser's direction, not final · **[Proposed]** = suggested, not yet confirmed · **[Open]** = still to decide

---

## 1. Pitch

You are the AI of a derelict space platform/starship. When intruders breach the hull, the ship fabricates repair and combat drones to stop them reaching the bridge and shutting you down. Between breaches, your drones roam the dark, maze-like corridors to salvage parts, repair broken systems and capture tech from the invaders.

**Genre mix:** turn-based squad tactics (XCOM) + deckbuilder/roguelite (Slay the Spire, Monster Train) + dark derelict exploration (Dungeon of the Endless).

**[Decided] Design pillars** (test every feature against these):
1. **You are the ship.** You play as the AI: programming drones, sealing doors, killing the lights.
2. **Greed vs. safety.** Every drone out exploring is one not guarding the bridge.
3. **Dread through darkness.** Atmosphere is a mechanic, not just mood.

## 2. Team & tools

- **[Decided]** Solo developer: Fraser. Partner may contribute artwork.
- **[Decided]** Engine: **Godot 4**. Fraser has no prior Godot/Unity experience and will learn it.
- **[Decided]** Language: **GDScript**.
- **[Decided]** Git + Git LFS from day one (art and audio files via LFS).
- **[Decided]** Workflow: design and brainstorming in this Claude project; building in Claude Code with `DESIGN.md` + `CLAUDE.md` in the repo.

## 3. Core loop

### Turns — [Decided] XCOM-style, not watched simulation
A round = **your turn** then **the enemy turn**.

**Your turn**
- Draw up to 5 cards; power refills.
- Activate drones in any order. Each drone has **2 AP**: move + act, or one long move.
- Actions depend on chassis and modules: Shoot, Overwatch, Repair, Salvage, Scan, Hack.
- Play cards at any point, interleaved with drone actions (e.g. *Overclock* for +1 AP to reach a flanking tile).
- Drones you don't activate go on **Overwatch** automatically.

**Enemy turn:** invaders move and attack. Invaders in the dark appear only as **motion-tracker blips**.

### Breach countdown — [Decided]
Breaches are telegraphed a few turns ahead rather than every turn: *"Breach at Airlock C in 2 turns."*
- **Quiet turns:** explore, salvage, repair.
- **Breach turns:** pull back and fight.
- Invaders that survive stay on the map, as do your drones.

### Run structure — [Decided] one platform, opened deck by deck
- A run takes place on **one platform**. Drones, damage, repairs and claimed decks all persist for the whole run; no special carry-over rules needed.
- **Opening:** the AI is dormant. An approaching ship/invaders are detected and the platform's defence systems wake you up, in the **central base on the command deck**.
- The wake-up doubles as the **tutorial**: systems come online one at a time (lights, fabricator, first drone).
- You're **aware of the other decks but can't access them** at first.
- For now the platform has **3 decks: command deck + 1 above + 1 below.**
- **Invaders can breach any deck** and try to capture that deck's command post, including decks you can't reach yet.
- The run is split into **3 acts**, one per deck (see *Acts* below).
- **Platform layout is generated fresh every run.**

## 3b. Platform & decks

### Deck layout — [Decided]
- Each deck is rings around the core: **hull rooms with airlocks** (outside) → **systems ring** (generators, lighting relays, fabricators) → **core** (centre).
- Connected by radial and ring corridors, so there are loops and flanking routes. Procgen fills ring segments with hand-made room templates.
- Decks have identities: hangars/cargo (salvage, fabrication) above, reactor/engineering (power) below.
- **[Leaning]** The map changes a little during a run (e.g. Breachers cutting through walls, the odd collapsed corridor), not wholesale.

### Command posts — [Decided]
- Each deck has a **command post**. Holding it gives you that deck's systems: doors, lights, turrets, some extra power.
- Lose it and the deck's systems switch sides. **Invaders turn the floodlights on** in decks they hold, so you lose your darkness advantage there.
- **Why invaders want them:** each captured post is progress towards **overriding the bridge**. Posts **speed up a bridge override but never win on their own**; the bridge stays the thing you defend.

### Decks you can't reach yet — [Decided]
- Shown on a minimap/status panel: breach alerts, blips, capture progress. Never hidden from you (darkness rule).
- **Resolved abstractly** (a capture progress bar), not as full tactical fights, until you open access. Keeps turns fast.
- When you open a deck, it becomes a full tactical map, and you may be **retaking** it rather than claiming it.
- **Opening a deck is the big decision of each act:** what's there (power vs salvage) vs which one the invaders are taking.

### Acts — [Decided]
- **3 acts = 3 decks.** Act 1: command deck only. Act 2: open your first choice of deck. Act 3: open the other. Beat the act 3 boss = run won.
- **Acts end on an event, not a turn limit.** The boss arrival is the climax; there is no "rounds ran out" state.
- **Act flow** (~12–18 rounds per act, tune in playtesting):
  1. **Opening:** wake-up (act 1) or opening the new deck (acts 2–3).
  2. **Breaches:** ~3 telegraphed breaches, escalating, spread across reachable and unreachable decks. Quiet turns between them.
  3. **Boss warning:** *"Boarding vessel docking at Airlock X in 4 turns."* Visible countdown, last chance to bring drones home.
  4. **Boss incursion:** fight it out.
  5. **Lull:** no new breaches. Repair bay, shop, event, rewards; then the next act starts.
- **Leftover invaders persist.** Anything alive when the boss arrives joins the boss fight; anything alive after it stays dug in for the next act. Messy play has a cost, not a hard fail.
- **Boss location:** always on a deck you can fight on, telegraphed in advance. Act 1 → command deck; act 2 → the deck you just opened; act 3 (final) → the command deck, straight at the bridge.
- **Bosses have a goal, not just a big health bar.** Defeat them *or* stop their goal. Examples:
  - **Siege Breacher:** drills a new corridor towards the bridge a few tiles per turn.
  - **Signal Commander:** hacks a drone each turn while alive; kill the relay pylons it deploys.
- Run length target: ~45 rounds plus lulls, roughly 1–1.5 hours (similar to Slay the Spire / Monster Train).

### Lifts
- **[Decided]** Lifts open **automatically between acts**: at the end of the lull you choose up or down and that lift comes online. No mid-act opening, so acts stay one deck each.
- **[Proposed]** A rare card can give an early *peek* at a sealed deck (scan it, or send one drone ahead) without fully opening it.
- **[Decided]** Riding costs a full turn, capacity ~2 drones; lifts can be locked or sabotaged.
- **[Decided]** Service lifts are usable by both sides: a back door to watch.
- **[Decided]** Cap decks actively in play at ~2–3 so turns don't drag.

## 4. Cards — [Decided]

Drones are moved directly, so cards are the **ship AI's commands**.

| Type | Example | Effect |
|---|---|---|
| Fabricate | Sentry Drone | Builds a drone at the fabrication bay |
| Tactical | Overclock | One drone gets +1 AP this turn |
| Tactical | Targeting Uplink | +30% aim on the next shot |
| System | Emergency Bulkhead | Seals a door; invaders must re-route |
| System | Kill the Lights | Plunges a section into darkness |
| System | Vent Section | Vents a room into space, including your own drones |
| Module | Plasma Cutter (from a Breacher) | Permanently installed; drone can cut through walls |

- **Module cards** are where captured tech goes. They turn basic drones into specialists, like XCOM soldier classes.
- Some cards can hurt you too (e.g. *Vent Section*): power with a cost.

## 5. Drones

- **[Decided]** **Persistent:** they stay on the map until destroyed.
- **[Decided]** **Attachment:** serial names, kill counts, veterancy upgrades. Losing a veteran should hurt.
- **[Decided]** **Squad size is set by power, not a hard cap.** Every drone costs power upkeep each turn, which is power you can't spend on cards. More drones = fewer plays per turn. Numbers come from playtesting.
- **[Decided]** **Tactics:** half/full cover (consoles, crates, door frames), overwatch, flanking, fog of war.
- **[Decided]** **Hit chance:** shown, but a miss is a **graze** for partial damage (avoids stacking card RNG on top of "95% and missed").

## 6. Resources

**[Decided] Framing:** the station already *has* its own technology; what it lacks is raw resources to build with. Invaders arrive after the station has been derelict for thousands of years, so their tech is genuinely different and new to you.

- **[Decided] Power:** refills every turn; spent on cards and drone upkeep. Repairing generators and holding command posts raise it. Main brake on snowballing.
- **[Leaning] Matter** (name not final; replaces "Scrap"): banked across the run. The fabricators take in matter and restructure it into whatever you need. Spent on fabricating, repairs, card upgrades and card removal.
- **[Decided]** **Tech is a reward, not a currency.** No tech counter.

**[Proposed] Where new cards come from:**
- **Recovered station tech:** after millennia dormant, the AI's databanks are corrupted. Repairing archives/data cores restores blueprints it once had. Fits "you are the ship": you get stronger by remembering.
- **Captured invader tech:** alien modules from husks (see below). The only truly *new* tech.

**[Proposed] Where matter comes from:** salvaged wreckage, broken station fittings, dead invaders, and recycling your own damaged drones.
- Creates a choice on every kill: **kill → matter now**, or **Disable + haul the husk home → tech**.

### Capturing tech — [Decided]
Finish an invader with a **Disable** effect instead of a kill to leave a husk. A drone must haul it back to base across the dangerous map, then you pick from tech cards tied to that enemy type.

## 7. Darkness — [Decided]

- Unpowered sections are dark. Repairing lighting relays reveals corridors permanently; lights flicker when something approaches.
- **Twist:** drones see with sensors, invaders need light. Darkness hurts *them*: kill the lights and they lose aim and vision while you hunt them. You're the monster in their horror movie.
- **Rule:** darkness may hide information you can go and get, never information you need to avoid an unfair loss.

## 8. Invaders

- **[Leaning]** **Different invader factions on different runs, ~3–4 in total.** Each run faces one faction (or a mix, TBD) with its own look, units and bosses.

**[Decided] Archetypes** (roles each faction fills in its own way):

| Archetype | Role |
|---|---|
| Runner | Fast and fragile; beelines for the bridge |
| Brute | Tank |
| Saboteur | Targets components you've repaired |
| Hacker | Takes control of one of your drones for a turn |
| Breacher | Cuts through walls, reshaping the maze; punishes turtling |
| Stalker | Invisible while in darkness |

**[Decided] Enemy AI:** for each invader, score reachable tiles on progress to bridge, cover, shot on a drone and flanking; pick the best.

## 9. Visuals & art

- **[Decided]** **3D with an orthographic isometric camera**, not 2D iso sprites: easy dynamic lighting/shadows/flashlight cones, wall cutaway shader, one animated model instead of 4–8 sprite directions.
- **[Decided]** **3D world:** free low-poly sci-fi kits (Kenney, Quaternius) + Godot lighting and fog.
- **[Decided]** **Partner's area (2D layer):** card art, concept art, drone/invader portraits, UI, icons, logo, Steam store art.
- **[Decided]** Partner works in **illustration and painting**, **traditionally** (physical media). Every piece needs scanning/photographing at high resolution plus digital cleanup; budget time for this.
- **[Decided] Art direction: "painted cards, moody 3D world."** Her paintings are the game's identity (cards, portraits, key art); the 3D world stays simple and is unified with them through palette and lighting rather than detail.
  - **Her paintings set the palette.** The 3D lighting, fog and UI colours are picked from her work, so the two layers feel like one game.
  - **[Proposed — under discussion] Colour coding:** one accent for the ship/drones (e.g. cold cyan) and one for invaders (e.g. warm sodium orange) against near-black.
  - **3D world:** low-poly kits with flat or lightly textured materials; optionally a subtle painterly post-process (posterise, edge darkening) later. Mood comes from lights and fog.
  - **Card art workload:** one illustration per card *family* plus tinted/cropped variants, not one per card. ~120 cards ≈ 30–40 paintings.
  - **Consistent framing:** fixed card-art aspect ratio and composition template, painted at 2× final resolution.
- **[Decided]** Make a shared mood board early so placeholder kits and final art feel like one game.
- **Reference games:** Darkest Dungeon (painted, dark, readable), Slay the Spire / Monster Train (card art), Inscryption (moody card game), Dungeon of the Endless (dark derelict).

## 10. Technical architecture

**[Leaning] Keep the simulation separate from presentation** (Redux-style: state store, commands as actions, rules as reducers, scene as the view). Learn Godot the normal node-based way in Phase 1, then use the split from the grey-box onwards.
- Game state (grid, units, deck, resources) in plain scripts → free save/load, undo, AI, seeded RNG.
- Commands (PlayCard, MoveDrone, EndTurn) are validated then applied; the resolver emits events (UnitMoved, Damaged, DoorSealed…) that scene nodes animate.
- **[Leaning]** Content is data: cards, drones and enemies as custom `Resource` classes built from small effects (Damage, Move, ApplyStatus, Spawn, Seal).

| Need | Godot feature |
|---|---|
| Isometric view | `Camera3D`, projection = Orthogonal |
| Tile maps | `GridMap` + `MeshLibrary` |
| Pathfinding | `AStarGrid2D` (logic is a flat 2D grid) |
| Card/drone/enemy data | Custom `Resource` classes |
| Smooth movement | `Tween` |
| Atmosphere | `OmniLight3D` / `SpotLight3D` + `WorldEnvironment` fog/glow |
| Global state | Autoload |

**[Decided] Map generation:** layouts are generated every run, but procgen is built only once the loop is fun on a hand-made map. Stitch hand-authored room templates on a grid, connect as a spanning tree, add ~15% extra links for loops, check breach-to-bridge distances are fair.

## 11. Roadmap — rough order, not gates

No paper prototype and no hard "don't move on until yes" gates. The grey-box is the first playable test.

| Phase | Build | Worth checking |
|---|---|---|
| 1. Learn Godot (~1 month) | Official tutorials + "tactics toy" | Can you move a unit on a grid and end a turn? |
| 2. Grey-box (~2–3 months) | Hand-made map, 3 drones, 3 invaders, cover, overwatch, ~15 cards, breach countdown, win/lose | Is act 1 (command deck only) fun to replay? |
| 3. Systems | Darkness/vision, exploration, salvage, repair, captured tech, rewards, generated maps | Does exploring create stories? |
| 4. Vertical slice | Art pass, audio, UI, ~40 cards, a boss | Would a stranger want more? |
| 5. Full run | All 3 decks / acts, lifts, command posts, events, shop, invader factions, AI cores (starting decks), ~120 cards | Does a run make you want another? |
| 6. Ship it | Demo → Steam Next Fest → Early Access | — |

**Learning path (Phase 1):** Godot docs → *Getting Started: Step by step* → *Your first 2D game* → *Your first 3D game*. Then the tactics toy: ortho iso camera, GridMap floor/walls, click-to-move with pathfinding, End Turn button with an enemy stepping toward the bridge.

## 12. Risks

- **Snowballing:** power upkeep, drone cap, drone degradation, scaling waves, Breachers/Saboteurs.
- **Slow turns:** auto-overwatch, small squads, fast enemy-turn animations.
- **Readability in the dark:** tactical overlay toggle, clear intent indicators, distinct silhouettes. Spooky, never confusing.
- **Double randomness:** grazes instead of clean misses.
- **Scope creep:** procgen only once the loop is fun; meta-progression only once a run is fun. 3–4 invader factions is a lot of content; start with one.

## 13. Games to study

Monster Train · Dungeon of the Endless · Into the Breach · XCOM 2 · Slay the Spire · FTL · Alien: Isolation (sound, motion tracker)

## 14. Open questions

- [Open] Name for the second resource: Matter, Mass, Feedstock…?
- [Open] Colour coding: ship vs invader accents, and does each faction get its own? (To be worked out together.)
- [Open] Invader factions: who are they, and does a run face one faction or a mix?
- [Open] Game title.
