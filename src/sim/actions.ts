// Drone actions and shared movement.

import { CONFIG } from './config';
import { canTarget, resolveShot, triggerOverwatch } from './combat';
import { gainMatter } from './economy';
import { CARDS } from './content/cards';
import { MODULE_POOLS } from './content/modules';
import { planMove } from './pathfinding';
import { shipSeesUnit } from './vision';
import { unitById } from './units';
import type { Command, GameEvent, GameState, Unit, Vec } from './types';

export type Emit = (e: GameEvent) => void;

/**
 * Moves a unit tile by tile. Invaders trigger drone overwatch after each step;
 * the move stops if the invader dies. Returns false if the unit died.
 */
export function moveAlong(s: GameState, unit: Unit, path: Vec[], emit: Emit): boolean {
  let segment: Vec[] = [];
  let seen: boolean[] = [];
  const flush = () => {
    if (segment.length === 0) return;
    emit({ type: 'unitMoved', unitId: unit.id, path: segment, ...(unit.side === 'invader' ? { seen } : {}) });
    segment = [];
    seen = [];
  };
  const husk = unit.carrying !== null ? s.husks.find((h) => h.id === unit.carrying) : undefined;
  for (const step of path) {
    unit.pos = { ...step };
    if (husk) husk.pos = { ...step };
    segment.push({ ...step });
    seen.push(shipSeesUnit(s, unit));
    if (unit.side === 'invader' && s.units.some((u) => u.side === 'drone' && u.overwatch && canTarget(s, u, unit))) {
      flush();
      if (triggerOverwatch(s, unit, emit)) return false;
    }
  }
  flush();
  return true;
}

export function doMove(s: GameState, cmd: Extract<Command, { type: 'move' }>, emit: Emit): void {
  const u = unitById(s, cmd.unitId)!;
  const plan = planMove(s, u, cmd.to)!;
  u.ap -= plan.ap;
  u.acted = true;
  moveAlong(s, u, plan.path, emit);
  tryDeliver(s, u, emit);
}

// ---------------------------------------------------------------------------
// Capturing tech: a Worker hauls a husk to the fabricator, then you pick a module.

export function doPickUp(s: GameState, cmd: Extract<Command, { type: 'pickUp' }>, emit: Emit): void {
  const u = unitById(s, cmd.unitId)!;
  const husk = s.husks.find((h) => h.id === cmd.huskId)!;
  u.ap -= 1;
  u.acted = true;
  u.carrying = husk.id;
  husk.carriedBy = u.id;
  husk.pos = { ...u.pos };
  emit({ type: 'huskPickedUp', unitId: u.id, huskId: husk.id });
  tryDeliver(s, u, emit);
}

export function doDrop(s: GameState, cmd: Extract<Command, { type: 'drop' }>, emit: Emit): void {
  const u = unitById(s, cmd.unitId)!;
  const husk = s.husks.find((h) => h.id === u.carrying)!;
  u.carrying = null;
  husk.carriedBy = null;
  husk.pos = { ...u.pos };
  emit({ type: 'huskDropped', huskId: husk.id, pos: { ...husk.pos } });
}

/** A hauler that reaches the working fabricator hands over its husk: pick a module. */
export function tryDeliver(s: GameState, u: Unit, emit: Emit): void {
  if (u.carrying === null) return;
  const fab = s.systems.find((x) => x.kind === 'fabricator' && x.working);
  if (!fab || !withinReach(u.pos, fab.pos)) return;
  const husk = s.husks.find((h) => h.id === u.carrying)!;
  s.husks = s.husks.filter((h) => h.id !== husk.id);
  u.carrying = null;
  s.stats.husksCaptured++;
  emit({ type: 'huskDelivered', huskId: husk.id, from: husk.type });
  const options = MODULE_POOLS[husk.type] ?? [];
  if (options.length > 0) s.pendingChoice = { from: husk.type, options: [...options] };
}

export function doChooseModule(s: GameState, cmd: Extract<Command, { type: 'chooseModule' }>, emit: Emit): void {
  const choice = s.pendingChoice!;
  const moduleId = choice.options[cmd.index];
  s.pendingChoice = null;
  const cardId = `module:${moduleId}`;
  if (!CARDS[cardId]) return;
  s.deck.hand.push({ uid: s.nextId++, cardId });
  emit({ type: 'moduleChosen', moduleId });
}

export function doShoot(s: GameState, cmd: Extract<Command, { type: 'shoot' }>, emit: Emit): void {
  const u = unitById(s, cmd.unitId)!;
  const target = unitById(s, cmd.targetId)!;
  // Shooting ends the drone's activation (XCOM rule).
  u.ap = 0;
  u.acted = true;
  u.overwatch = false;
  resolveShot(s, u, target, {}, emit);
}

export function doOverwatch(s: GameState, cmd: Extract<Command, { type: 'overwatch' }>, emit: Emit): void {
  const u = unitById(s, cmd.unitId)!;
  u.ap = 0;
  u.acted = true;
  u.overwatch = true;
  emit({ type: 'overwatchSet', unitId: u.id });
}

/** Chebyshev adjacency (or same tile): systems and salvage can be worked from a diagonal too. */
export function withinReach(a: Vec, b: Vec): boolean {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
}

export function repairCost(kind: string): number {
  return CONFIG.worker.repairCost[kind] ?? 0;
}

export function doSalvage(s: GameState, cmd: Extract<Command, { type: 'salvage' }>, emit: Emit): void {
  const u = unitById(s, cmd.unitId)!;
  const spot = s.salvage.find((x) => x.id === cmd.spotId)!;
  u.ap -= 1;
  u.acted = true;
  spot.charges -= 1;
  const amount = CONFIG.worker.salvageYield;
  gainMatter(s, amount);
  emit({ type: 'salvaged', unitId: u.id, spotId: spot.id, amount });
  emit({ type: 'matterChanged', matter: s.matter, delta: amount, reason: 'salvage' });
}

export function doRepair(s: GameState, cmd: Extract<Command, { type: 'repair' }>, emit: Emit): void {
  const u = unitById(s, cmd.unitId)!;
  const sys = s.systems.find((x) => x.id === cmd.systemId)!;
  const cost = repairCost(sys.kind);
  u.ap -= 1;
  u.acted = true;
  s.matter -= cost;
  sys.working = true;
  sys.repaired = true;
  emit({ type: 'matterChanged', matter: s.matter, delta: -cost, reason: `${sys.name} repair` });
  emit({ type: 'systemRepaired', systemId: sys.id });
}
