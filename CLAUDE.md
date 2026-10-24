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
  ai.ts             enemy turn
  economy.ts        power, upkeep, matter, deck draws
  units.ts          unit creation, derived stats (config + modules)
  describe.ts       event → log line
  content/          map (ASCII), drones/invaders, modules
src/ui/             React: renders state, plays back events
```

## Map

`src/sim/content/map.ts` holds the command deck as ASCII rows plus zone
rectangles (rooms/corridors used for lighting) and relay definitions. The map
test checks every floor tile is in a zone and every airlock can reach the
bridge. Movement is 4-directional.

## Workflow

- Work on the branch you were given; commit each milestone and push.
- Run `npm run check` before committing.
