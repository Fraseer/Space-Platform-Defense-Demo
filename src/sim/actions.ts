// Drone actions and shared movement.

import { CONFIG } from './config';
import { canTarget, resolveShot, triggerOverwatch } from './combat';
import { gainMatter } from './economy';
import { planMove } from './pathfinding';
import { shipCanSee } from './vision';
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
  for (const step of path) {
    unit.pos = { ...step };
    segment.push({ ...step });
    seen.push(unit.side === 'drone' || shipCanSee(s, step));
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
