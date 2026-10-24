import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { coverAgainst } from '../combat';
import { decide, planIntents } from '../ai';
import { goalField } from '../pathfinding';
import { applyCommand } from '../reducer';
import { newGame } from '../setup';
import { idx } from '../grid';
import type { GameState } from '../types';
import { addDrone, addInvader, testState } from './helpers';

const LONG = {
  rows: ['##########################', '#........................#', '##########################'],
  zones: [
    { id: 'bridge', name: 'Bridge', kind: 'bridge' as const, rect: [1, 1, 1, 1] as [number, number, number, number] },
    { id: 'hall', name: 'Hall', kind: 'corridor' as const, rect: [0, 0, 25, 2] as [number, number, number, number] },
  ],
};

describe('runner', () => {
  it('dashes toward the bridge when nothing is in sight', () => {
    const s = testState(LONG.rows, { zones: LONG.zones });
    const r = addInvader(s, 'runner', 24, 1);
    const plan = decide(s, r);
    expect(plan.ap).toBe(2);
    expect(plan.path[plan.path.length - 1]).toEqual({ x: 24 - 2 * CONFIG.invaders.runner.move, y: 1 });
  });

  it('stays on the bridge and wears down its integrity', () => {
    const s = testState(LONG.rows, { zones: LONG.zones });
    addInvader(s, 'runner', 1, 1);
    s.breaches = [{ index: 0, airlock: 'A', warnRound: 1, arriveRound: 99, units: [], announced: true, arrived: false, boss: false }];
    const r = applyCommand(s, { type: 'endTurn' });
    expect(r.state.units[0].pos).toEqual({ x: 1, y: 1 });
    expect(r.state.bridge.integrity).toBe(s.bridge.integrity - CONFIG.invaders.runner.override);
  });

  it('overriding the bridge loses the game', () => {
    const s = testState(LONG.rows, { zones: LONG.zones });
    addInvader(s, 'runner', 1, 1);
    s.bridge.integrity = 1;
    const r = applyCommand(s, { type: 'endTurn' });
    expect(r.state.status).toBe('lost');
    expect(r.events.some((e) => e.type === 'gameOver')).toBe(true);
    expect(applyCommand(r.state, { type: 'endTurn' }).ok).toBe(false);
  });
});

describe('brute', () => {
  it('takes a covered firing position over an exposed one', () => {
    // The drone sits at the left; crates one move away give cover facing it.
    const s = testState([
      '##############',
      '#............#',
      '#.......h....#',
      '#............#',
      '#.......h....#',
      '#............#',
      '##############',
    ], {
      zones: [
        { id: 'bridge', name: 'Bridge', kind: 'bridge', rect: [1, 1, 1, 1] },
        { id: 'room', name: 'Room', kind: 'room', rect: [0, 0, 13, 6] },
      ],
    });
    const d = addDrone(s, 'sentry', 3, 3);
    const b = addInvader(s, 'brute', 10, 3);
    const plan = decide(s, b);
    const dest = plan.path.length ? plan.path[plan.path.length - 1] : b.pos;
    expect(plan.action).toEqual({ kind: 'shoot', targetId: d.id });
    expect(coverAgainst(s, dest, d.pos)).toBeGreaterThan(0);
  });

  it('heads for the bridge when it sees no drone', () => {
    const s = testState(LONG.rows, { zones: LONG.zones });
    const b = addInvader(s, 'brute', 24, 1);
    const field = goalField(s, s.bridgeTiles);
    const plan = decide(s, b);
    const dest = plan.path[plan.path.length - 1];
    expect(field[idx(s, dest)]).toBeLessThan(field[idx(s, b.pos)]);
  });
});

describe('saboteur', () => {
  function relayRoom(): GameState {
    const s = testState([
      '##########',
      '#........#',
      '#.1......#',
      '#........#',
      '##########',
    ], {
      zones: [
        { id: 'bridge', name: 'Bridge', kind: 'bridge', rect: [8, 1, 8, 1] },
        { id: 'room', name: 'Room', kind: 'room', rect: [0, 0, 9, 4] },
      ],
      relays: { '1': { name: 'Relay', lights: ['room'] } },
    });
    return s;
  }

  it('ignores broken systems and goes for the bridge', () => {
    const s = relayRoom();
    const sab = addInvader(s, 'saboteur', 5, 2);
    const plan = decide(s, sab);
    expect(plan.action?.kind).not.toBe('sabotage');
  });

  it('walks to a repaired relay and breaks it', () => {
    const s = relayRoom();
    const relay = s.systems[0];
    relay.working = true;
    relay.repaired = true;
    addInvader(s, 'saboteur', 7, 2);
    s.breaches = [{ index: 0, airlock: 'A', warnRound: 1, arriveRound: 99, units: [], announced: true, arrived: false, boss: false }];
    const r = applyCommand(s, { type: 'endTurn' });
    expect(r.events.some((e) => e.type === 'systemSabotaged')).toBe(true);
    expect(r.state.systems[0].working).toBe(false);
  });
});

describe('intents', () => {
  it('match what invaders actually do when nothing interferes', () => {
    let s = newGame(11);
    // Fast-forward to the first breach, then compare plan and outcome.
    while (!s.units.some((u) => u.side === 'invader')) s = applyCommand(s, { type: 'endTurn' }).state;
    for (const d of s.units.filter((u) => u.side === 'drone')) {
      d.acted = true; // no auto-overwatch, so nothing interrupts the moves
      d.pos = { x: 11 + (d.id % 2) * 2, y: 13 }; // out of the way on the bridge
    }
    const intents = planIntents(s);
    const r = applyCommand(s, { type: 'endTurn' });
    for (const it of intents) {
      const after = r.state.units.find((u) => u.id === it.unitId)!;
      const expected = it.path.length ? it.path[it.path.length - 1] : it.from;
      expect(after.pos).toEqual(expected);
    }
  });
});

describe('breach schedule', () => {
  it('announces the first breach at the start and spawns it on time at its airlock', () => {
    let s = newGame(5);
    const first = s.breaches[0];
    expect(first.announced).toBe(true);
    expect(s.breaches[1].announced).toBe(false);
    while (s.round < first.arriveRound - 1) s = applyCommand(s, { type: 'endTurn' }).state;
    expect(s.units.some((u) => u.side === 'invader')).toBe(false);
    const r = applyCommand(s, { type: 'endTurn' });
    expect(r.state.round).toBe(first.arriveRound);
    const spawned = r.state.units.filter((u) => u.side === 'invader');
    expect(spawned.map((u) => u.type).sort()).toEqual([...first.units].sort());
    const airlock = r.state.airlocks.find((a) => a.id === first.airlock)!;
    for (const u of spawned) expect(Math.abs(u.pos.x - airlock.pos.x) + Math.abs(u.pos.y - airlock.pos.y)).toBeLessThanOrEqual(3);
  });

  it('is deterministic for a seed', () => {
    const play = (seed: number) => {
      let s = newGame(seed);
      for (let i = 0; i < 8; i++) s = applyCommand(s, { type: 'endTurn' }).state;
      return JSON.stringify(s);
    };
    expect(play(99)).toBe(play(99));
    expect(play(99)).not.toBe(play(100));
  });
});
