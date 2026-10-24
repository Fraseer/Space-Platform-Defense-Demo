// Enemy turn. Milestone 2 placeholder: each invader shoots a drone if it has a
// shot, otherwise walks toward the bridge (and shoots if the move gave it one).

import { moveAlong, type Emit } from './actions';
import { canTarget, previewShot, resolveShot } from './combat';
import { idx, posOf } from './grid';
import { goalField, moveField, pathFromField } from './pathfinding';
import { drones, invaders, stats, unitById } from './units';
import type { GameState, Unit } from './types';

function bestTarget(s: GameState, u: Unit): Unit | null {
  let best: Unit | null = null;
  let bestValue = -1;
  for (const d of drones(s)) {
    if (!canTarget(s, u, d)) continue;
    const p = previewShot(s, u, d);
    const value = p.chance * p.damage;
    if (value > bestValue) {
      bestValue = value;
      best = d;
    }
  }
  return best;
}

function stepToward(s: GameState, u: Unit, field: number[], emit: Emit): boolean {
  const mf = moveField(s, u, stats(u).move);
  let bestI = -1;
  let bestD = field[idx(s, u.pos)];
  for (let i = 0; i < mf.dist.length; i++) {
    if (mf.dist[i] <= 0) continue;
    if (s.units.some((o) => idx(s, o.pos) === i)) continue;
    if (field[i] < bestD) {
      bestD = field[i];
      bestI = i;
    }
  }
  if (bestI < 0) {
    u.ap = 0; // nowhere better to go
    return true;
  }
  const path = pathFromField(s, mf, posOf(s, bestI))!;
  u.ap -= 1;
  return moveAlong(s, u, path, emit);
}

export function runEnemyPhase(s: GameState, emit: Emit): void {
  const field = goalField(s, s.bridgeTiles);
  for (const id of invaders(s).map((u) => u.id)) {
    const u = unitById(s, id);
    if (!u) continue;
    u.ap = 2;
    while (u.ap > 0) {
      const target = bestTarget(s, u);
      if (target) {
        u.ap = 0;
        resolveShot(s, u, target, {}, emit);
        break;
      }
      if (!stepToward(s, u, field, emit)) break; // died to overwatch
      if (!unitById(s, id)) break;
    }
  }
}
