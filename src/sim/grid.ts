// Grid queries: tile lookups, passability, line of sight, cover providers.

import type { Door, GameState, TileKind, Unit, Vec } from './types';

export const DIRS4: readonly Vec[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

type Grid = Pick<GameState, 'width' | 'height' | 'tiles' | 'doors'>;

export function idx(s: Pick<GameState, 'width'>, p: Vec): number {
  return p.y * s.width + p.x;
}

export function posOf(s: Pick<GameState, 'width'>, i: number): Vec {
  return { x: i % s.width, y: Math.floor(i / s.width) };
}

export function inBounds(s: Pick<GameState, 'width' | 'height'>, p: Vec): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height;
}

export function samePos(a: Vec, b: Vec): boolean {
  return a.x === b.x && a.y === b.y;
}

export function tileAt(s: Grid, p: Vec): TileKind {
  return inBounds(s, p) ? s.tiles[idx(s, p)] : 'wall';
}

export function doorAt(s: Grid, p: Vec): Door | undefined {
  return s.doors.find((d) => d.pos.x === p.x && d.pos.y === p.y);
}

export function isSealed(s: Grid, p: Vec): boolean {
  const d = doorAt(s, p);
  return !!d && d.sealedRounds > 0;
}

/** Can a unit stand on / walk through this tile (ignoring other units)? */
export function isWalkable(s: Grid, p: Vec): boolean {
  const t = tileAt(s, p);
  if (t === 'floor' || t === 'airlock') return true;
  if (t === 'door') return !isSealed(s, p);
  return false;
}

/** Does this tile block line of sight? */
export function isOpaque(s: Grid, p: Vec): boolean {
  const t = tileAt(s, p);
  if (t === 'wall' || t === 'full' || t === 'system') return true;
  if (t === 'door') return isSealed(s, p);
  return false;
}

/** Cover this tile gives a unit standing next to it: 0 none, 1 half, 2 full. */
export function coverOf(s: Grid, p: Vec): 0 | 1 | 2 {
  const t = tileAt(s, p);
  if (t === 'half') return 1;
  if (t === 'wall' || t === 'full' || t === 'system') return 2;
  if (t === 'door' && isSealed(s, p)) return 2;
  return 0;
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function manhattan(a: Vec, b: Vec): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isAdjacent(a: Vec, b: Vec): boolean {
  return manhattan(a, b) === 1;
}

/**
 * Line of sight between tile centres. Walks every tile the segment touches
 * (supercover); a segment passing exactly through a corner is only blocked if
 * both tiles beside that corner are opaque. Symmetric: los(a,b) === los(b,a).
 */
export function hasLineOfSight(s: Grid, a: Vec, b: Vec): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const nx = Math.abs(dx);
  const ny = Math.abs(dy);
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  let x = a.x;
  let y = a.y;
  let ix = 0;
  let iy = 0;
  while (ix < nx || iy < ny) {
    const decision = (1 + 2 * ix) * ny - (1 + 2 * iy) * nx;
    if (decision === 0) {
      if (isOpaque(s, { x: x + sx, y }) && isOpaque(s, { x, y: y + sy })) return false;
      x += sx;
      y += sy;
      ix++;
      iy++;
    } else if (decision < 0) {
      x += sx;
      ix++;
    } else {
      y += sy;
      iy++;
    }
    if (x === b.x && y === b.y) return true;
    if (isOpaque(s, { x, y })) return false;
  }
  return true;
}

export function unitAt(s: Pick<GameState, 'units'>, p: Vec): Unit | undefined {
  return s.units.find((u) => u.pos.x === p.x && u.pos.y === p.y);
}
