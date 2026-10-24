// Pathfinding on the 4-connected grid.
//  - moveField: BFS of where one unit can walk this action (used for drones and invaders).
//  - goalField: weighted distance-to-goal map the invader AI uses to judge progress.

import { CONFIG } from './config';
import { DIRS4, idx, inBounds, isSealed, isWalkable, posOf, tileAt } from './grid';
import { stats } from './units';
import type { GameState, Side, Unit, Vec } from './types';

export interface MoveField {
  /** Steps from the unit to each tile, -1 if unreachable. */
  dist: number[];
  prev: number[];
}

function occupancy(s: GameState): (Side | null)[] {
  const occ: (Side | null)[] = new Array(s.width * s.height).fill(null);
  for (const u of s.units) occ[idx(s, u.pos)] = u.side;
  return occ;
}

/** Tiles a unit can walk to within maxSteps. Friendly units can be walked through; enemies block. */
export function moveField(s: GameState, unit: Unit, maxSteps: number): MoveField {
  const n = s.width * s.height;
  const dist = new Array<number>(n).fill(-1);
  const prev = new Array<number>(n).fill(-1);
  const occ = occupancy(s);
  const start = idx(s, unit.pos);
  dist[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (dist[cur] >= maxSteps) continue;
    const p = posOf(s, cur);
    for (const d of DIRS4) {
      const np = { x: p.x + d.x, y: p.y + d.y };
      if (!inBounds(s, np) || !isWalkable(s, np)) continue;
      const ni = idx(s, np);
      if (dist[ni] >= 0) continue;
      const o = occ[ni];
      if (o !== null && o !== unit.side) continue;
      dist[ni] = dist[cur] + 1;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  return { dist, prev };
}

/** Path from the field's origin to `to`, excluding the origin. */
export function pathFromField(s: GameState, field: MoveField, to: Vec): Vec[] | null {
  let i = idx(s, to);
  if (field.dist[i] < 0) return null;
  const path: Vec[] = [];
  while (field.dist[i] > 0) {
    path.push(posOf(s, i));
    i = field.prev[i];
  }
  return path.reverse();
}

export interface MoveOption {
  pos: Vec;
  steps: number;
  ap: number;
}

/** AP a move of `steps` tiles costs: 1 within move range, 2 for a dash. */
export function apForSteps(steps: number, move: number): number {
  return steps <= move ? 1 : 2;
}

/** Most AP a single move action can spend. */
function maxMoveAp(unit: Unit): number {
  return Math.min(unit.ap, 2);
}

/** Every tile the unit can end a single move action on, with its AP cost. */
export function moveOptions(s: GameState, unit: Unit): MoveOption[] {
  const apBudget = maxMoveAp(unit);
  const move = stats(unit).move;
  if (apBudget <= 0 || move <= 0) return [];
  const field = moveField(s, unit, move * apBudget);
  const occ = occupancy(s);
  const out: MoveOption[] = [];
  for (let i = 0; i < field.dist.length; i++) {
    const steps = field.dist[i];
    if (steps <= 0 || occ[i] !== null) continue;
    out.push({ pos: posOf(s, i), steps, ap: apForSteps(steps, move) });
  }
  return out;
}

/** The path and AP cost for moving `unit` to `to`, or null if it can't get there this action. */
export function planMove(s: GameState, unit: Unit, to: Vec): { path: Vec[]; ap: number } | null {
  const apBudget = maxMoveAp(unit);
  const move = stats(unit).move;
  if (apBudget <= 0 || move <= 0) return null;
  if (s.units.some((u) => u.pos.x === to.x && u.pos.y === to.y)) return null;
  const field = moveField(s, unit, move * apBudget);
  const path = pathFromField(s, field, to);
  if (!path || path.length === 0) return null;
  return { path, ap: apForSteps(path.length, move) };
}

// ---------------------------------------------------------------------------

class MinHeap {
  private items: [number, number][] = [];
  get size(): number {
    return this.items.length;
  }
  push(priority: number, value: number): void {
    const a = this.items;
    a.push([priority, value]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Distance from every tile to the nearest goal tile, for invaders. Units are
 * ignored (they move); sealed doors count as passable but expensive, so
 * invaders re-route around a bulkhead when there is a reasonable way round
 * and otherwise wait it out.
 */
export function goalField(s: GameState, goals: number[]): number[] {
  const n = s.width * s.height;
  const dist = new Array<number>(n).fill(Infinity);
  const heap = new MinHeap();
  for (const g of goals) {
    dist[g] = 0;
    heap.push(0, g);
  }
  const enterCost = (p: Vec) => 1 + (isSealed(s, p) ? CONFIG.ai.sealedDoorCost : 0);
  const passable = (p: Vec) => isWalkable(s, p) || (tileAt(s, p) === 'door' && isSealed(s, p));
  while (heap.size > 0) {
    const [d, cur] = heap.pop();
    if (d > dist[cur]) continue;
    const p = posOf(s, cur);
    const step = enterCost(p);
    for (const dir of DIRS4) {
      const np = { x: p.x + dir.x, y: p.y + dir.y };
      if (!inBounds(s, np) || !passable(np)) continue;
      const ni = idx(s, np);
      const nd = d + step;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        heap.push(nd, ni);
      }
    }
  }
  return dist;
}
