import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { COMMAND_DECK, type Ring } from '../content/map';
import { DIRS4, idx, isWalkable, posOf } from '../grid';
import { goalField } from '../pathfinding';
import { newGame } from '../setup';
import type { Vec } from '../types';

describe('command deck map', () => {
  const s = newGame(1);
  const ringOf = (p: Vec): Ring | undefined => COMMAND_DECK.zones[s.zoneOf[idx(s, p)]]?.ring;
  /** The walkable tiles either side of a door, as a pair. */
  const sides = (door: Vec): [Vec, Vec] => {
    const ew = [{ x: door.x - 1, y: door.y }, { x: door.x + 1, y: door.y }];
    const ns = [{ x: door.x, y: door.y - 1 }, { x: door.x, y: door.y + 1 }];
    const pair = ew.every((p) => isWalkable(s, p)) ? ew : ns;
    return [pair[0], pair[1]];
  };
  const doorsBetween = (a: Ring, b: Ring) =>
    s.doors
      .map((d) => d.pos)
      .filter((d) => {
        const [p, q] = sides(d).map(ringOf);
        return (p === a && q === b) || (p === b && q === a);
      });

  it('is rectangular', () => {
    for (const row of COMMAND_DECK.rows) expect(row.length).toBe(COMMAND_DECK.rows[0].length);
  });

  it('puts every floor, cover and system tile in a zone, and every zone in a ring', () => {
    const orphans = s.tiles
      .map((t, i) => ({ t, i }))
      .filter(({ t, i }) => t !== 'wall' && t !== 'door' && t !== 'airlock' && s.zoneOf[i] < 0)
      .map(({ i }) => posOf(s, i));
    expect(orphans).toEqual([]);
    expect(COMMAND_DECK.zones.filter((z) => !z.ring).map((z) => z.id)).toEqual([]);
  });

  it('has 3 airlocks, a fabricator, a generator and 3 relays', () => {
    expect(s.airlocks.map((a) => a.id)).toEqual(['A', 'B', 'C']);
    expect(s.systems.filter((x) => x.kind === 'fabricator')).toHaveLength(1);
    expect(s.systems.filter((x) => x.kind === 'generator')).toHaveLength(1);
    expect(s.systems.filter((x) => x.kind === 'relay')).toHaveLength(3);
    expect(s.bridgeTiles.length).toBeGreaterThan(0);
  });

  it('has no dead doors: every door joins two walkable tiles on opposite sides', () => {
    const dead = s.doors
      .map((d) => d.pos)
      .filter((d) => {
        const ew = isWalkable(s, { x: d.x - 1, y: d.y }) && isWalkable(s, { x: d.x + 1, y: d.y });
        const ns = isWalkable(s, { x: d.x, y: d.y - 1 }) && isWalkable(s, { x: d.x, y: d.y + 1 });
        return !ew && !ns;
      });
    expect(dead).toEqual([]);
  });

  it('only joins neighbouring rings: hull → systems → inner corridor → bridge, never skipping one', () => {
    const order: Ring[] = ['hull', 'systems', 'inner', 'core'];
    const skips = s.doors
      .map((d) => d.pos)
      .filter((d) => {
        const [a, b] = sides(d).map((p) => order.indexOf(ringOf(p)!));
        return Math.abs(a - b) > 1;
      });
    expect(skips).toEqual([]);
    // Nothing walkable sits next to a tile two rings away either (no gaps in the walls).
    for (let i = 0; i < s.tiles.length; i++) {
      const p = posOf(s, i);
      if (!isWalkable(s, p) || !ringOf(p)) continue;
      for (const d of DIRS4) {
        const n = { x: p.x + d.x, y: p.y + d.y };
        if (!isWalkable(s, n) || !ringOf(n)) continue;
        expect(Math.abs(order.indexOf(ringOf(p)!) - order.indexOf(ringOf(n)!))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('staggers the gates: no straight run from one ring into the next ring inward', () => {
    const hullGates = doorsBetween('hull', 'systems');
    const innerGates = doorsBetween('systems', 'inner');
    const bridgeGates = doorsBetween('inner', 'core');
    expect(hullGates.length).toBeGreaterThan(0);
    expect(innerGates.length).toBeGreaterThan(0);
    expect(bridgeGates.length).toBeGreaterThanOrEqual(2); // more than one way in, so there are loops
    const walk = (from: Vec[], to: Vec[]) => {
      const field = goalField(s, to.map((p) => idx(s, p)));
      return Math.min(...from.map((p) => field[idx(s, p)]));
    };
    expect(walk(hullGates, innerGates)).toBeGreaterThanOrEqual(8);
    expect(walk(innerGates, bridgeGates)).toBeGreaterThanOrEqual(5);
  });

  it('keeps every invader at least 3 turns from the bridge, at roughly fair distances per airlock', () => {
    const field = goalField(s, s.bridgeTiles);
    const dists = s.airlocks.map((a) => field[idx(s, a.pos)]);
    for (const d of dists) expect(Number.isFinite(d)).toBe(true);
    const fastest = Math.max(...Object.values(CONFIG.invaders).map((u) => u.move));
    for (const d of dists) expect(Math.ceil(d / (fastest * CONFIG.turn.apPerTurn))).toBeGreaterThanOrEqual(3);
    expect(Math.max(...dists) - Math.min(...dists)).toBeLessThanOrEqual(8);
  });
});
