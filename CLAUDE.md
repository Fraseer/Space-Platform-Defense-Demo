# Space Platform Defense — Act 1 web demo

A throwaway browser prototype of act 1 (the command deck) to test whether the
core loop is fun before building the real game in Godot. `DESIGN.md` is the
full game design; where it disagrees with the demo's scope, the demo scope wins
(act 1 only: no other decks, lifts, command posts, shop, events, procgen,
factions, art, audio, save/load or meta-progression).

## Commands

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173/?seed=123
npm test           # Vitest, core rules (src/sim/__tests__)
npm run typecheck  # app + sim (no DOM) + node configs
npm run lint       # ESLint, including the sim import rule
npm run check      # typecheck + lint + test — run before every commit
npm run build      # typecheck, then static site in dist/
npm run balance    # greedy bot over 40 seeds: win rate + run length (tools/)
```

The seed comes from `?seed=` (numbers are used as-is, other text is hashed). If
there is no seed, a random one is written to the URL.

## Architecture rules

- **`src/sim/` is pure TypeScript.** No React, no DOM, no `src/ui` imports.
  Enforced by ESLint (`no-restricted-imports`) and `tsconfig.sim.json`, which
  compiles the sim with only the ES2022 lib.
- **One entry point:** `applyCommand(state, command)` validates the command
  (`validate.ts`), applies it to a *copy* of the state and returns
  `{ ok, state, events }` (or `{ ok: false, error }`). Never mutate the state
  passed in; inside the reducer, mutate the cloned draft freely.
- **GameState is plain data** (no classes, Maps, functions). The RNG state lives
  in `GameState.rng`, so the same seed + the same commands replay the same game.
  Never use `Math.random` in `src/sim`.
- **Events describe what happened** (`unitMoved`, `shot`, `damaged`,
  `doorSealed`…). React renders state and animates events; it never infers game
  rules or changes game state.
- **Content is data.** Cards, drones, invaders and modules live in
  `src/sim/content/` as plain objects. Cards are lists of small effects run by
  one interpreter, not one class per card.
- **All balance numbers live in `src/sim/config.ts`.** Content files reference
  config; no other file hard-codes a gameplay number.
- **Rules get tests.** Hit chance, cover, overwatch, power upkeep, pathing,
  vision and AI behaviour are covered in `src/sim/__tests__`. Use the helpers in
  `__tests__/helpers.ts` to build tiny ASCII maps for focused tests.

## Layout

```
src/sim/            pure simulation
  config.ts         every balance number
  types.ts          GameState, Command, GameEvent…
  reducer.ts        applyCommand
  validate.ts       command legality (also used by the UI)
  setup.ts          map loading, newGame(seed)
  grid.ts           tiles, line of sight, cover providers
  pathfinding.ts    move ranges (BFS) and invader goal fields (Dijkstra)
  actions.ts        drone actions, movement
  turn.ts           end turn → enemy phase → next round
  combat.ts         hit chance breakdown, cover/flank, grazes, overwatch
  vision.ts         lighting zones, ship sight, blips, invader vision
  effects.ts        card targeting + the effect interpreter
  ai.ts             enemy turn: tile scoring, intents
  director.ts       breach schedule, spawns
  boss.ts           Siege Breacher, drill tunnel, Drill Rig
  economy.ts        power, upkeep, matter, deck draws
  units.ts          unit creation, derived stats (config + modules)
  describe.ts       event → log line
  debug.ts          playtest shortcuts (skip to boss)
  content/          map (ASCII), cards, drones/invaders, modules
src/ui/             React: renders state, plays back events
  glyphs.tsx        every map drawing piece, shared by MapView and MapKey
  icons/ icons.tsx  standalone SVG icons (currentColor) and the <symbol> sprite
tools/              balance bot (`npm run balance`)
```

## Map

When you add something new to the map, draw it in `src/ui/glyphs.tsx` and add
an entry to the key (`src/ui/MapKey.tsx`).

`src/sim/content/map.ts` holds the command deck as ASCII rows plus zone
rectangles (rooms/corridors used for lighting, each tagged with its ring) and
relay definitions. Movement is 4-directional.

The deck is four rings (hull → systems → inner corridor → bridge) with
**staggered gates**: hull→systems doors only at the corners, systems→inner only
west/east, inner→bridge only north/south, so there is no straight run to the
centre. `map.test.ts` enforces this: every floor tile in a zone, no dead doors
(each door joins two walkable tiles), doors only between neighbouring rings,
gates staggered, and every invader at least 3 turns from the bridge.

## Rules worth knowing before changing code

- A round is the player's turn then the enemy phase (`turn.ts`): auto-overwatch
  → enemy phase (boss first) → bridge override → timers → director (spawns
  breaches due next round, announces warnings) → next round (power refill,
  brownout, AP reset, draw).
- The AI never rolls dice; only shots do. `planIntents` re-runs the same
  decisions on a copy of the state for the tactical overlay. Invaders only plan
  around drones they can see from where they start their turn.
- Fog of war is a sim rule: `shipSeesUnit` / `seenInvaderIds` decide what is a
  blip; move events carry per-step `seen` flags so the UI never leaks.
- Boss units (`alwaysVisible`) are never blips; the drill route is always shown.

## Workflow

- Work on the branch you were given; commit each milestone and push.
- Every push to it (or `main`) runs `.github/workflows/deploy-pages.yml`:
  `npm ci`, `npm run check`, `npm run build`, then publishes `dist/` to
  https://fraseer.github.io/Space-Platform-Defense-Demo/. The build uses a
  relative base (`base: './'` in vite.config.ts) so it works under that sub-path.
- Run `npm run check` before committing.
