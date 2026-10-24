import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { coverAgainst, previewShot, resolveShot } from '../combat';
import { applyCommand } from '../reducer';
import type { GameEvent } from '../types';
import { addDrone, addInvader, testState } from './helpers';

const C = CONFIG.combat;
const SENTRY = CONFIG.drones.sentry;

const OPEN = ['...........', '...........', '...........', '...........', '...........'];

describe('hit chance', () => {
  it('starts from the shooter aim with no cover inside optimal range', () => {
    const s = testState(OPEN);
    const d = addDrone(s, 'sentry', 0, 2);
    const t = addInvader(s, 'runner', 4, 2);
    const p = previewShot(s, d, t);
    expect(p.chance).toBe(SENTRY.aim);
    expect(p.flanked).toBe(true);
    expect(p.damage).toBe(SENTRY.damage + C.flankDamageBonus);
  });

  it('falls off beyond optimal range', () => {
    const s = testState(['..........................']);
    const d = addDrone(s, 'sentry', 0, 0);
    const t = addInvader(s, 'runner', SENTRY.optimalRange + 3, 0);
    expect(previewShot(s, d, t).chance).toBe(SENTRY.aim - 3 * C.rangeFalloffPerTile);
  });

  it('applies half and full cover only from the covered side', () => {
    const s = testState([
      '.........',
      '....h....',
      '....T....',
      '.........',
      '.........',
    ].map((r) => r.replace('T', '.')));
    const target = { x: 4, y: 2 };
    expect(coverAgainst(s, target, { x: 4, y: 0 })).toBe(1); // straight over the crate
    expect(coverAgainst(s, target, { x: 2, y: 0 })).toBe(1); // diagonal, still behind it
    expect(coverAgainst(s, target, { x: 4, y: 4 })).toBe(0); // from behind: flanked
    expect(coverAgainst(s, target, { x: 8, y: 2 })).toBe(0); // from the side: flanked
    const w = testState(['.....', '..#..', '.....']);
    expect(coverAgainst(w, { x: 2, y: 2 }, { x: 2, y: 0 })).toBe(2);
  });

  it('adds Targeting Uplink and subtracts the overwatch penalty, clamped to 5–95', () => {
    const s = testState(OPEN);
    const d = addDrone(s, 'sentry', 0, 2);
    const t = addInvader(s, 'runner', 4, 2);
    d.aimBonus = 30;
    expect(previewShot(s, d, t).chance).toBe(C.maxHit);
    d.aimBonus = 0;
    expect(previewShot(s, d, t, { overwatch: true }).chance).toBe(SENTRY.aim - C.overwatchPenalty);
  });

  it('never drops below the minimum', () => {
    // Worker diagonal to a Brute that hugs a wall: full cover, on overwatch.
    const s = testState(['.......', '....#..', '.......']);
    const w = addDrone(s, 'worker', 1, 0);
    const b = addInvader(s, 'brute', 4, 2);
    const p = previewShot(s, w, b, { overwatch: true });
    expect(p.cover).toBe(2);
    expect(p.chance).toBe(C.minHit);
  });
});

describe('grazes', () => {
  it('never misses cleanly: a miss deals partial damage', () => {
    // Worker vs a Brute in full cover: 15% to hit, so most shots are grazes.
    const g = testState(['.......', '....#..', '.......']);
    const d = addDrone(g, 'worker', 1, 0);
    const t = addInvader(g, 'brute', 4, 2);
    const misses: number[] = [];
    for (let i = 0; i < 40; i++) {
      g.rng = i;
      t.hp = 12;
      const events: GameEvent[] = [];
      resolveShot(g, d, t, {}, (e) => events.push(e));
      const shot = events.find((e) => e.type === 'shot');
      if (shot?.type === 'shot' && !shot.info.hit) misses.push(12 - t.hp);
    }
    expect(misses.length).toBeGreaterThan(20);
    const expected = Math.ceil(CONFIG.drones.worker.damage * C.grazeRatio);
    for (const m of misses) expect(m).toBe(expected);
  });
});

describe('shooting through the reducer', () => {
  it('kills, counts the kill, drops matter and ends the activation', () => {
    const s = testState(OPEN);
    const d = addDrone(s, 'sentry', 0, 2);
    const t = addInvader(s, 'runner', 3, 2);
    t.hp = 1;
    const r = applyCommand(s, { type: 'shoot', unitId: d.id, targetId: t.id });
    expect(r.ok).toBe(true);
    expect(r.state.units.find((u) => u.id === t.id)).toBeUndefined();
    const shooter = r.state.units.find((u) => u.id === d.id)!;
    expect(shooter.kills).toBe(1);
    expect(shooter.ap).toBe(0);
    expect(r.state.matter).toBe(s.matter + CONFIG.invaders.runner.matterDrop);
  });

  it('rejects shots without line of sight or out of range', () => {
    const s = testState(['.....#.....']);
    const d = addDrone(s, 'sentry', 0, 0);
    const t = addInvader(s, 'runner', 8, 0);
    expect(applyCommand(s, { type: 'shoot', unitId: d.id, targetId: t.id }).ok).toBe(false);
  });
});

describe('overwatch', () => {
  const CORRIDOR = ['####################', '....................', '####################'];
  const zones = [
    { id: 'b', name: 'Bridge', kind: 'bridge' as const, rect: [0, 1, 0, 1] as [number, number, number, number] },
    { id: 'room', name: 'Room', kind: 'room' as const, rect: [0, 0, 19, 2] as [number, number, number, number] },
  ];

  it('untouched drones go on overwatch at end of turn and fire once at a moving invader', () => {
    const s = testState(CORRIDOR, { zones });
    const d = addDrone(s, 'sentry', 1, 1);
    const moved = addDrone(s, 'worker', 2, 1, 1);
    moved.acted = true;
    addInvader(s, 'runner', 19, 1);
    const r = applyCommand(s, { type: 'endTurn' });
    const sets = r.events.filter((e) => e.type === 'overwatchSet').map((e) => (e as { unitId: number }).unitId);
    expect(sets).toEqual([d.id]);
    const owShots = r.events.filter((e) => e.type === 'shot' && e.info.overwatch);
    expect(owShots).toHaveLength(1);
    expect(owShots[0]).toMatchObject({ shooterId: d.id });
  });

  it('stops the invader where it dies', () => {
    const s = testState(CORRIDOR, { zones });
    const d = addDrone(s, 'sentry', 1, 1);
    d.overwatch = true;
    d.acted = true;
    const inv = addInvader(s, 'runner', 12, 1);
    inv.hp = 1; // any graze kills it
    const r = applyCommand(s, { type: 'endTurn' });
    expect(r.state.units.find((u) => u.id === inv.id)).toBeUndefined();
    const moves = r.events.filter((e) => e.type === 'unitMoved' && e.unitId === inv.id);
    expect(moves).toHaveLength(1);
    // The sentry sees down the whole corridor, so it fires on the first step.
    expect((moves[0] as { path: unknown[] }).path).toHaveLength(1);
  });

  it('does not fire at invaders it cannot see', () => {
    const s = testState(['#####', '..#..', '#####'], {
      zones: [
        { id: 'b', name: 'Bridge', kind: 'bridge', rect: [4, 1, 4, 1] },
        { id: 'room', name: 'Room', kind: 'room', rect: [0, 0, 4, 2] },
      ],
    });
    const d = addDrone(s, 'sentry', 0, 1);
    d.overwatch = true;
    d.acted = true;
    addInvader(s, 'runner', 3, 1);
    const r = applyCommand(s, { type: 'endTurn' });
    expect(r.events.some((e) => e.type === 'shot')).toBe(false);
  });
});
