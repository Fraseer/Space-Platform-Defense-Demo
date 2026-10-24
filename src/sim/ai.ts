// Enemy turn. Milestone 1: every invader walks toward the bridge.

import { moveAlong, type Emit } from './actions';
import { idx } from './grid';
import { goalField, moveField, pathFromField } from './pathfinding';
import { invaders, stats } from './units';
import type { GameState, Unit, Vec } from './types';

function bestTileToward(s: GameState, u: Unit, field: number[]): Vec | null {
  const move = stats(u).move * 2;
  const mf = moveField(s, u, move);
  let best: Vec | null = null;
  let bestScore = field[idx(s, u.pos)];
  for (let i = 0; i < mf.dist.length; i++) {
    if (mf.dist[i] <= 0) continue;
    if (s.units.some((o) => idx(s, o.pos) === i)) continue;
    if (field[i] < bestScore) {
      bestScore = field[i];
      best = { x: i % s.width, y: Math.floor(i / s.width) };
    }
  }
  return best;
}

export function runEnemyPhase(s: GameState, emit: Emit): void {
  const field = goalField(s, s.bridgeTiles);
  for (const u of invaders(s)) {
    const to = bestTileToward(s, u, field);
    if (!to) continue;
    const path = pathFromField(s, moveField(s, u, stats(u).move * 2), to);
    if (path) moveAlong(s, u, path, emit);
  }
}
