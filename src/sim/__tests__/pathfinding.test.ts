import { describe, expect, it } from 'vitest';
import { applyCommand } from '../reducer';
import { goalField, moveOptions, planMove } from '../pathfinding';
import { idx } from '../grid';
import { addDrone, addInvader, testState } from './helpers';

const ROWS = [
  '##########',
  '#........#',
  '#.######.#',
  '#........#',
  '##########',
];

describe('drone movement', () => {
  it('costs 1 AP within move range and 2 AP for a dash', () => {
    const s = testState(ROWS);
    const d = addDrone(s, 'sentry', 1, 1); // move 4
    expect(planMove(s, d, { x: 5, y: 1 })?.ap).toBe(1);
    expect(planMove(s, d, { x: 7, y: 1 })?.ap).toBe(2);
    expect(planMove(s, d, { x: 8, y: 3 })).toBeNull(); // 9 steps, beyond a dash of 8
  });

  it('goes around walls, not through them', () => {
    const s = testState(ROWS);
    const d = addDrone(s, 'sentry', 1, 1);
    const plan = planMove(s, d, { x: 1, y: 3 });
    expect(plan?.path).toEqual([
      { x: 1, y: 2 },
      { x: 1, y: 3 },
    ]);
    const s2 = testState(['#####', '#.#.#', '#####']);
    const d2 = addDrone(s2, 'sentry', 1, 1);
    expect(planMove(s2, d2, { x: 3, y: 1 })).toBeNull();
  });

  it('only allows a dash with 2 AP left', () => {
    const s = testState(ROWS);
    const d = addDrone(s, 'sentry', 1, 1, 1);
    expect(planMove(s, d, { x: 5, y: 1 })?.ap).toBe(1);
    expect(planMove(s, d, { x: 7, y: 1 })).toBeNull();
  });

  it('walks through friendly drones but not invaders, and never ends on a unit', () => {
    const s = testState(['#######', '#.....#', '#######']);
    const d = addDrone(s, 'sentry', 1, 1);
    addDrone(s, 'worker', 2, 1);
    expect(planMove(s, d, { x: 3, y: 1 })).not.toBeNull();
    expect(planMove(s, d, { x: 2, y: 1 })).toBeNull();
    addInvader(s, 'runner', 4, 1);
    expect(planMove(s, d, { x: 5, y: 1 })).toBeNull();
  });

  it('is blocked by sealed doors', () => {
    const s = testState(['#####', '#.+.#', '#####']);
    const d = addDrone(s, 'sentry', 1, 1);
    expect(planMove(s, d, { x: 3, y: 1 })).not.toBeNull();
    s.doors[0].sealedRounds = 2;
    expect(planMove(s, d, { x: 3, y: 1 })).toBeNull();
  });

  it('lists move options with the right AP costs', () => {
    const s = testState(ROWS);
    const d = addDrone(s, 'sentry', 1, 1);
    const opts = moveOptions(s, d);
    expect(opts.find((o) => o.pos.x === 4 && o.pos.y === 1)?.ap).toBe(1);
    expect(opts.find((o) => o.pos.x === 8 && o.pos.y === 2)?.ap).toBe(2);
  });

  it('spends AP through the reducer and leaves the input state untouched', () => {
    const s = testState(ROWS);
    const d = addDrone(s, 'sentry', 1, 1);
    const r = applyCommand(s, { type: 'move', unitId: d.id, to: { x: 4, y: 1 } });
    expect(r.ok).toBe(true);
    expect(r.state.units[0].pos).toEqual({ x: 4, y: 1 });
    expect(r.state.units[0].ap).toBe(1);
    expect(s.units[0].pos).toEqual({ x: 1, y: 1 });
    expect(r.events[0]).toMatchObject({ type: 'unitMoved', unitId: d.id });
    const bad = applyCommand(r.state, { type: 'move', unitId: d.id, to: { x: 8, y: 3 } });
    expect(bad.ok).toBe(false);
  });
});

describe('invader goal field', () => {
  it('routes around a sealed door when a detour exists', () => {
    const s = testState([
      '#######',
      '#..+..#',
      '#.###.#',
      '#.....#',
      '#######',
    ]);
    const goal = idx(s, { x: 5, y: 1 });
    const open = goalField(s, [goal]);
    expect(open[idx(s, { x: 1, y: 1 })]).toBe(4);
    s.doors[0].sealedRounds = 3;
    const sealed = goalField(s, [goal]);
    expect(sealed[idx(s, { x: 1, y: 1 })]).toBe(8); // the long way round
  });
});
