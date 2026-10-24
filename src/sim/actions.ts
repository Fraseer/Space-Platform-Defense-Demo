// Drone actions and shared movement.

import { planMove } from './pathfinding';
import { unitById } from './units';
import type { Command, GameEvent, GameState, Unit, Vec } from './types';

export type Emit = (e: GameEvent) => void;

/** Moves a unit tile by tile. Returns false if the unit was stopped (e.g. killed on the way). */
export function moveAlong(_s: GameState, unit: Unit, path: Vec[], emit: Emit): boolean {
  const walked: Vec[] = [];
  for (const step of path) {
    unit.pos = { ...step };
    walked.push({ ...step });
  }
  if (walked.length > 0) emit({ type: 'unitMoved', unitId: unit.id, path: walked });
  return true;
}

export function doMove(s: GameState, cmd: Extract<Command, { type: 'move' }>, emit: Emit): void {
  const u = unitById(s, cmd.unitId)!;
  const plan = planMove(s, u, cmd.to)!;
  u.ap -= plan.ap;
  u.acted = true;
  moveAlong(s, u, plan.path, emit);
}
