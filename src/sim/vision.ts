// Light and sight.
//  - A zone is lit if it is always lit (bridge, fabrication bay) or a working
//    relay lights it, unless Kill the Lights has darkened it.
//  - The ship sees every lit tile (its cameras work where its lights do),
//    everything within a drone's sensor radius and line of sight, and
//    anything inside an active Scan. Every other invader is a blip: the
//    motion tracker always shows where it is, never what it is.
//  - Invaders need light: in the dark they see only a few tiles and lose aim.

import { CONFIG } from './config';
import { INVADERS } from './content/units';
import { DIRS4, distance, hasLineOfSight, idx, inBounds } from './grid';
import { stats } from './units';
import type { GameState, InvaderType, Unit, Vec } from './types';

export function isZoneLit(s: GameState, zone: number): boolean {
  const z = s.zones[zone];
  if (!z || z.darkRounds > 0) return false;
  if (z.alwaysLit) return true;
  return s.systems.some((x) => x.kind === 'relay' && x.working && x.lights.includes(zone));
}

/** Doors and airlocks take their light from the zones beside them. */
export function isLit(s: GameState, p: Vec): boolean {
  if (!inBounds(s, p)) return false;
  const z = s.zoneOf[idx(s, p)];
  if (z >= 0) return isZoneLit(s, z);
  return DIRS4.some((d) => {
    const n = { x: p.x + d.x, y: p.y + d.y };
    if (!inBounds(s, n)) return false;
    const nz = s.zoneOf[idx(s, n)];
    return nz >= 0 && isZoneLit(s, nz);
  });
}

/** Per-tile light map (for rendering and bulk queries). */
export function litMap(s: GameState): boolean[] {
  const zoneLit = s.zones.map((_, i) => isZoneLit(s, i));
  return s.tiles.map((_, i) => {
    const z = s.zoneOf[i];
    if (z >= 0) return zoneLit[z];
    const x = i % s.width;
    const y = Math.floor(i / s.width);
    return DIRS4.some((d) => {
      const n = { x: x + d.x, y: y + d.y };
      if (!inBounds(s, n)) return false;
      const nz = s.zoneOf[idx(s, n)];
      return nz >= 0 && zoneLit[nz];
    });
  });
}

export function droneSenses(s: GameState, p: Vec): boolean {
  return s.units.some((d) => d.side === 'drone' && distance(d.pos, p) <= stats(d).sensor && hasLineOfSight(s, d.pos, p));
}

export function inScan(s: GameState, p: Vec): boolean {
  return s.scans.some((sc) => distance(sc.center, p) <= sc.radius);
}

export function shipCanSee(s: GameState, p: Vec): boolean {
  return isLit(s, p) || inScan(s, p) || droneSenses(s, p);
}

/**
 * What the ship sees per tile: 2 lit, 1 seen by sensors or a scan only, 0 unseen.
 * Used to shade the map.
 */
export function sightMap(s: GameState): (0 | 1 | 2)[] {
  const lit = litMap(s);
  return s.tiles.map((t, i) => {
    if (lit[i]) return 2;
    if (t === 'wall') return 0;
    const p = { x: i % s.width, y: Math.floor(i / s.width) };
    return inScan(s, p) || droneSenses(s, p) ? 1 : 0;
  });
}

/** Invaders need light: in the dark (theirs or the target's) they only see a few tiles. */
export function invaderCanSee(s: GameState, from: Vec, to: Vec): boolean {
  const range = isLit(s, from) && isLit(s, to) ? CONFIG.vision.invaderLitVision : CONFIG.vision.invaderDarkVision;
  return distance(from, to) <= range && hasLineOfSight(s, from, to);
}

/** Aim invaders lose when they or their target stand in the dark. */
export function invaderAimPenaltyFromDark(s: GameState, from: Vec, to: Vec): number {
  return isLit(s, from) && isLit(s, to) ? 0 : CONFIG.combat.invaderDarkPenalty;
}

/** Can the ship see this unit right now? Drones always; boss units always; others by tile. */
export function shipSeesUnit(s: GameState, u: Unit, at: Vec = u.pos): boolean {
  if (u.side === 'drone') return true;
  if (INVADERS[u.type as InvaderType].alwaysVisible) return true;
  return shipCanSee(s, at);
}

/** Ids of invaders the ship can currently see (everything else is a blip). */
export function seenInvaderIds(s: GameState): Set<number> {
  return new Set(s.units.filter((u) => u.side === 'invader' && shipSeesUnit(s, u)).map((u) => u.id));
}
