import { describe, expect, it } from 'vitest';
import { COMMAND_DECK } from '../content/map';
import { idx, posOf } from '../grid';
import { goalField } from '../pathfinding';
import { newGame } from '../setup';

describe('command deck map', () => {
  const s = newGame(1);

  it('is rectangular', () => {
    for (const row of COMMAND_DECK.rows) expect(row.length).toBe(COMMAND_DECK.rows[0].length);
  });

  it('puts every floor, cover and system tile in a zone', () => {
    const orphans = s.tiles
      .map((t, i) => ({ t, i }))
      .filter(({ t, i }) => t !== 'wall' && t !== 'door' && t !== 'airlock' && s.zoneOf[i] < 0)
      .map(({ i }) => posOf(s, i));
    expect(orphans).toEqual([]);
  });

  it('has 3 airlocks, a fabricator, a generator and 3 relays', () => {
    expect(s.airlocks.map((a) => a.id)).toEqual(['A', 'B', 'C']);
    expect(s.systems.filter((x) => x.kind === 'fabricator')).toHaveLength(1);
    expect(s.systems.filter((x) => x.kind === 'generator')).toHaveLength(1);
    expect(s.systems.filter((x) => x.kind === 'relay')).toHaveLength(3);
    expect(s.bridgeTiles.length).toBeGreaterThan(0);
  });

  it('lets every airlock reach the bridge, at roughly fair distances', () => {
    const field = goalField(s, s.bridgeTiles);
    const dists = s.airlocks.map((a) => field[idx(s, a.pos)]);
    for (const d of dists) expect(Number.isFinite(d)).toBe(true);
    expect(Math.max(...dists) - Math.min(...dists)).toBeLessThanOrEqual(8);
  });

  it('has loops: the bridge is reachable through more than one door', () => {
    const bridgeDoors = s.doors.filter((d) => {
      const n = [
        { x: d.pos.x + 1, y: d.pos.y },
        { x: d.pos.x - 1, y: d.pos.y },
        { x: d.pos.x, y: d.pos.y + 1 },
        { x: d.pos.x, y: d.pos.y - 1 },
      ];
      return n.some((p) => s.bridgeTiles.includes(idx(s, p)));
    });
    expect(bridgeDoors.length).toBeGreaterThanOrEqual(3);
  });
});
