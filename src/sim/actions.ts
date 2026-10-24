// Drone actions and shared movement.

import { canTarget, resolveShot, triggerOverwatch } from './combat';
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
