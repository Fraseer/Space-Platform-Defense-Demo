import { describe, expect, it } from 'vitest';
import { hasLineOfSight } from '../grid';
import { testState } from './helpers';

describe('line of sight', () => {
  const s = testState([
    '.......',
    '...#...',
    '.......',
    '..h....',
    '.......',
  ]);

  it('is blocked by walls', () => {
    expect(hasLineOfSight(s, { x: 3, y: 0 }, { x: 3, y: 2 })).toBe(false);
  });

  it('is not blocked by half cover', () => {
    expect(hasLineOfSight(s, { x: 2, y: 2 }, { x: 2, y: 4 })).toBe(true);
  });

  it('is symmetric', () => {
    const pts = [];
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) if (s.tiles[y * s.width + x] === 'floor') pts.push({ x, y });
    for (const a of pts) for (const b of pts) expect(hasLineOfSight(s, a, b)).toBe(hasLineOfSight(s, b, a));
  });

  it('passes a corner unless both tiles beside it are opaque', () => {
    const t = testState([
      '...',
      '.#.',
      '#..',
    ]);
    // (0,1) → (1,2) diagonal passes the corner between (1,1)# and (0,2)#.
    expect(hasLineOfSight(t, { x: 0, y: 1 }, { x: 1, y: 2 })).toBe(false);
    // (0,0) → (2,2) passes centre of (1,1)# → blocked.
    expect(hasLineOfSight(t, { x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false);
    // (1,0) → (2,1): corner between (2,0). and (1,1)# → one open side, visible.
    expect(hasLineOfSight(t, { x: 1, y: 0 }, { x: 2, y: 1 })).toBe(true);
  });
});
