# Space Platform Defense — Act 1 demo

A throwaway browser prototype of act 1 of *Space Platform Defense*: the
command deck, from wake-up to the act 1 boss. It exists to test whether the
core loop is fun before building the real game in Godot. The full design is
in [DESIGN.md](DESIGN.md); developer notes are in [CLAUDE.md](CLAUDE.md).

```bash
npm install
npm run dev     # http://localhost:5173/?seed=123
```

A run takes about 20–25 rounds (roughly 15–20 minutes). The seed is in the
URL, so a run can be replayed or shared.

## How to play

You are the ship's AI. Invaders breach the hull at the airlocks and head for
the **bridge** in the centre. Each invader standing on a bridge tile at the end
of their turn drains bridge integrity; at 0 you lose. Survive three breaches,
then stop the **Siege Breacher**: kill (or disable) it, or destroy its **Drill
Rig** at the airlock it docked at.

**Your turn**

- Each drone has **2 AP**. A move within range costs 1 AP; a long move (dash)
  costs 2. **Shooting ends the drone's turn.** Drones you don't touch go on
  overwatch automatically at End Turn.
- Hit chance is shown before you fire. A miss is a **graze** for half damage,
  never a clean miss. Cover is directional; no cover facing the shooter means
  **flanked** (+1 damage).
- **Power** refills each turn to income − upkeep (1 per drone) and pays for
  cards. Too many drones → brownout (newest drones get 1 AP).
- **Matter** is banked: Workers salvage it (gold rings), kills drop it. It pays
  for fabricating drones and repairs.
- You keep unplayed cards and draw back up to 5. Once per turn you can scrap a
  card (right-click it).

**Darkness.** Rooms are dark unless a Worker repairs the relay (R) that lights
them. The ship sees lit rooms, and whatever is within a drone's sensor radius.
Everything else is a pulsing **blip**: you know where it is, not what it is.
Invaders need light: in the dark they see 3 tiles and lose aim.

**Capturing tech.** Play Disable Shot, then make the kill: the invader becomes
a husk. A Worker can pick it up and haul it to the fabricator (F). Pick one of
three module cards for that invader type, then play it on a drone to install it
permanently.

## Controls

| Input | Action |
|---|---|
| Click drone / Tab | Select drone |
| Click tile | Move (path and AP cost shown on hover) |
| Click invader, click again or F | Lock target (see hit chance), fire |
| O / S / R / H | Overwatch / Salvage / Repair / Pick up husk |
| 1–5 or click a card | Play card, then click its target |
| Right-click card | Scrap it (1 per turn) |
| Esc / right-click map | Cancel |
| E | End turn |
| T | Tactical overlay: enemy intent, weapon ranges, drill route |
| D | Debug: reveal everything, AI tile scores, skip to boss |

## Tuning

Every balance number is in [`src/sim/config.ts`](src/sim/config.ts). After
changing it, `npm run balance` plays a simple bot over 40 seeds and reports win
rate and run length (currently about 60% for the bot, ~22 rounds). The map is
ASCII in [`src/sim/content/map.ts`](src/sim/content/map.ts).
