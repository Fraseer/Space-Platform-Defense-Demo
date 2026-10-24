// The act script: telegraphed breaches with quiet turns between them, then
// the boss warning. Breaches are announced a few rounds ahead so the player
// can pull back in time.

import { DIRS4, idx, inBounds, isWalkable } from './grid';
import { createInvader } from './units';
import { shipCanSee } from './vision';
import type { Emit } from './actions';
import type { Breach, GameState, InvaderType, Vec } from './types';

/** Free walkable tiles nearest the airlock, airlock first. */
export function spawnTiles(s: GameState, airlock: Vec, count: number): Vec[] {
  const out: Vec[] = [];
  const seen = new Set<number>([idx(s, airlock)]);
  const queue = [airlock];
  for (let head = 0; head < queue.length && out.length < count; head++) {
    const p = queue[head];
    if (isWalkable(s, p) && !s.units.some((u) => u.pos.x === p.x && u.pos.y === p.y)) out.push(p);
    for (const d of DIRS4) {
      const n = { x: p.x + d.x, y: p.y + d.y };
      if (!inBounds(s, n) || seen.has(idx(s, n)) || !isWalkable(s, n)) continue;
      seen.add(idx(s, n));
      queue.push(n);
    }
  }
  return out;
}

export function airlockName(s: GameState, id: string): string {
  return s.airlocks.find((a) => a.id === id)?.name ?? `Airlock ${id}`;
}

/** Breaches announced at the very start of the run. */
export function openingWarnings(s: GameState): void {
  for (const b of s.breaches) if (b.warnRound <= s.round) b.announced = true;
}

/** Spawns one breach's invaders at its airlock. Returns the spawned units' ids. */
export function spawnBreach(s: GameState, b: Breach, types: InvaderType[], emit: Emit): number[] {
  const airlock = s.airlocks.find((a) => a.id === b.airlock)!;
  const tiles = spawnTiles(s, airlock.pos, types.length);
  const ids: number[] = [];
  types.forEach((type, i) => {
    const pos = tiles[i];
    if (!pos) return;
    const u = createInvader(s, type, pos);
    s.units.push(u);
    ids.push(u.id);
    emit({ type: 'unitSpawned', unit: { ...u, pos: { ...u.pos } }, seen: shipCanSee(s, u.pos) });
  });
  return ids;
}

/**
 * Runs between the enemy phase and the next round: spawns breaches due next
 * round and announces new warnings. `s.round` is still the round just played.
 */
export function runDirector(s: GameState, emit: Emit, spawnBoss: (s: GameState, b: Breach, emit: Emit) => void): void {
  const next = s.round + 1;
  for (const b of s.breaches) {
    if (b.arrived || b.arriveRound !== next) continue;
    b.arrived = true;
    b.announced = true;
    emit({ type: 'breach', airlock: b.airlock, boss: b.boss });
    if (b.boss) spawnBoss(s, b, emit);
    else spawnBreach(s, b, b.units, emit);
  }
  for (const b of s.breaches) {
    if (b.announced || b.warnRound !== next) continue;
    b.announced = true;
    emit({ type: 'breachWarning', airlock: b.airlock, inRounds: b.arriveRound - next, boss: b.boss });
  }
}
