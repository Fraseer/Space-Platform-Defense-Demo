import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { resolveShot } from '../combat';
import { planTunnel } from '../boss';
import { idx } from '../grid';
import { applyCommand } from '../reducer';
import { newGame } from '../setup';
import { stats } from '../units';
import type { Command, GameEvent, GameState } from '../types';
import { addDrone, addInvader, testState } from './helpers';

function run(s: GameState, cmd: Command) {
  const r = applyCommand(s, cmd);
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('Disable', () => {
  it('a lethal Disable shot leaves a husk instead of a corpse (and no matter)', () => {
    const s = testState(['.........']);
    const d = addDrone(s, 'sentry', 0, 0);
    const inv = addInvader(s, 'runner', 3, 0);
    inv.hp = 1;
    d.disableNext = true;
    const events: GameEvent[] = [];
    resolveShot(s, d, inv, {}, (e) => events.push(e));
    expect(s.husks).toHaveLength(1);
    expect(s.husks[0]).toMatchObject({ type: 'runner', pos: { x: 3, y: 0 } });
    expect(events.some((e) => e.type === 'disabled')).toBe(true);
    expect(s.matter).toBe(10);
    expect(d.disableNext).toBe(false);
  });

  it('a non-lethal shot keeps Disable for the next lethal one', () => {
    const s = testState(['.........']);
    const d = addDrone(s, 'sentry', 0, 0);
    const inv = addInvader(s, 'brute', 3, 0);
    d.disableNext = true;
    resolveShot(s, d, inv, {}, () => {});
    expect(inv.hp).toBeGreaterThan(0);
    expect(d.disableNext).toBe(true);
    expect(s.husks).toHaveLength(0);
    inv.hp = 1;
    resolveShot(s, d, inv, {}, () => {});
    expect(s.husks).toHaveLength(1);
    expect(d.disableNext).toBe(false);
  });
});

describe('hauling a husk', () => {
  function withHusk(): GameState {
    const s = newGame(3);
    const fab = s.systems.find((x) => x.kind === 'fabricator')!;
    s.husks.push({ id: 999, type: 'runner', pos: { x: fab.pos.x + 3, y: fab.pos.y }, carriedBy: null });
    const w = s.units.find((u) => u.type === 'worker')!;
    w.pos = { x: fab.pos.x + 3, y: fab.pos.y };
    w.ap = 3;
    return s;
  }

  it('only Workers can pick up husks, and hauling slows them', () => {
    const s = withHusk();
    const sentry = s.units.find((u) => u.type === 'sentry')!;
    sentry.pos = { x: s.husks[0].pos.x, y: s.husks[0].pos.y + 1 };
    expect(applyCommand(s, { type: 'pickUp', unitId: sentry.id, huskId: 999 }).ok).toBe(false);
    const w = s.units.find((u) => u.type === 'worker')!;
    const before = stats(w).move;
    const next = run(s, { type: 'pickUp', unitId: w.id, huskId: 999 }).state;
    const carrier = next.units.find((u) => u.id === w.id)!;
    expect(carrier.carrying).toBe(999);
    expect(stats(carrier).move).toBe(before - CONFIG.worker.haulMovePenalty);
  });

  it('delivering at the fabricator offers that enemy type\'s modules, and the pick goes into your hand', () => {
    const s = withHusk();
    const w = s.units.find((u) => u.type === 'worker')!;
    const fab = s.systems.find((x) => x.kind === 'fabricator')!;
    let next = run(s, { type: 'pickUp', unitId: w.id, huskId: 999 }).state;
    const r = run(next, { type: 'move', unitId: w.id, to: { x: fab.pos.x + 1, y: fab.pos.y } });
    next = r.state;
    expect(r.events.some((e) => e.type === 'huskDelivered')).toBe(true);
    expect(next.pendingChoice).toEqual({ from: 'runner', options: ['servoLegs', 'reflexLoop', 'featherweight'] });
    expect(applyCommand(next, { type: 'endTurn' }).ok).toBe(false);
    next = run(next, { type: 'chooseModule', index: 0 }).state;
    expect(next.pendingChoice).toBeNull();
    expect(next.deck.hand.some((c) => c.cardId === 'module:servoLegs')).toBe(true);
    expect(next.stats.husksCaptured).toBe(1);
  });

  it('a module card installs permanently on a drone and exhausts', () => {
    const s = newGame(3);
    const sentry = s.units.find((u) => u.type === 'sentry')!;
    s.deck.hand = [{ uid: 777, cardId: 'module:servoLegs' }];
    const next = run(s, { type: 'playCard', uid: 777, target: { kind: 'unit', unitId: sentry.id } }).state;
    const after = next.units.find((u) => u.id === sentry.id)!;
    expect(stats(after).move).toBe(CONFIG.drones.sentry.move + CONFIG.modules.servoLegs.move!);
    expect(next.deck.exhausted.map((c) => c.uid)).toContain(777);
  });

  it('a hauler that dies drops the husk where it fell', () => {
    const s = testState(['.........']);
    const w = addDrone(s, 'worker', 2, 0);
    s.husks.push({ id: 5, type: 'brute', pos: { x: 2, y: 0 }, carriedBy: w.id });
    w.carrying = 5;
    w.hp = 1;
    const b = addInvader(s, 'brute', 5, 0);
    resolveShot(s, b, w, {}, () => {});
    expect(s.husks[0]).toMatchObject({ carriedBy: null, pos: { x: 2, y: 0 } });
  });
});

describe('Siege Breacher', () => {
  it('plans a tunnel from every airlock to the bridge that avoids systems and the hull', () => {
    const s = newGame(1);
    for (const a of s.airlocks) {
      const t = planTunnel(s, a.pos);
      expect(t.length).toBeGreaterThan(0);
      expect(s.bridgeTiles).toContain(idx(s, t[t.length - 1]));
      for (const p of t) {
        expect(s.tiles[idx(s, p)]).not.toBe('system');
        expect(p.x > 0 && p.y > 0 && p.x < s.width - 1 && p.y < s.height - 1).toBe(true);
      }
    }
  });

  function toBoss(seed: number): GameState {
    let s = newGame(seed);
    const boss = s.breaches.find((b) => b.boss)!;
    // Skip the fight: clear the regular breaches and park the drones on the bridge.
    while (s.round < boss.arriveRound) {
      s = applyCommand(s, { type: 'endTurn' }).state;
      s.units = s.units.filter((u) => u.side === 'drone' || u.type === 'breacher' || u.type === 'rig');
      if (!s.units.some((u) => u.side === 'drone')) {
        addDrone(s, 'sentry', 11, 13);
      }
      s.bridge.integrity = s.bridge.max;
    }
    return s;
  }

  it('docks with its rig at the airlock on schedule and drills toward the bridge', () => {
    let s = toBoss(4);
    expect(s.boss).not.toBeNull();
    const rig = s.units.find((u) => u.type === 'rig')!;
    const boss = s.breaches.find((b) => b.boss)!;
    expect(rig.pos).toEqual(s.airlocks.find((a) => a.id === boss.airlock)!.pos);
    const tunnel = s.boss!.tunnel;
    s = applyCommand(s, { type: 'endTurn' }).state;
    expect(s.boss!.progress).toBe(Math.min(CONFIG.boss.drillSpeed, tunnel.length));
    for (const p of tunnel.slice(0, s.boss!.progress)) expect(s.tiles[idx(s, p)]).toBe('floor');
  });

  function arena(): { s: GameState; breacherId: number; rigId: number } {
    const s = testState(['###########', '#bb.......A', '###########'].map((r) => r.replace(/b/g, '.')), {
      zones: [
        { id: 'bridge', name: 'Bridge', kind: 'bridge', rect: [1, 1, 2, 1] },
        { id: 'hall', name: 'Hall', kind: 'corridor', rect: [0, 0, 10, 2] },
      ],
      alwaysLit: ['bridge', 'hall'],
      airlocks: { A: 'Airlock A' },
    });
    const rig = addInvader(s, 'rig', 10, 1);
    const breacher = addInvader(s, 'breacher', 8, 1);
    s.boss = { breacherId: breacher.id, rigId: rig.id, tunnel: [7, 6, 5, 4, 3, 2].map((x) => ({ x, y: 1 })), progress: 0 };
    s.breaches = [{ index: 0, airlock: 'A', warnRound: 1, arriveRound: 1, units: [], announced: true, arrived: true, boss: true }];
    return { s, breacherId: breacher.id, rigId: rig.id };
  }

  it('destroying the rig stops the drill and wins', () => {
    const { s, rigId } = arena();
    const d = addDrone(s, 'sentry', 9, 1);
    s.units.find((u) => u.id === rigId)!.hp = 1;
    const r = run(s, { type: 'shoot', unitId: d.id, targetId: rigId });
    expect(r.state.status).toBe('won');
    expect(r.state.outcome).toMatch(/Drill Rig/);
  });

  it('killing the Breacher wins', () => {
    const { s, breacherId } = arena();
    const d = addDrone(s, 'sentry', 5, 1);
    s.units.find((u) => u.id === breacherId)!.hp = 1;
    const r = run(s, { type: 'shoot', unitId: d.id, targetId: breacherId });
    expect(r.state.status).toBe('won');
    expect(r.state.outcome).toMatch(/destroyed/);
  });

  it('crushes a drone standing in the tunnel and jams for the turn', () => {
    const { s, breacherId } = arena();
    const d = addDrone(s, 'worker', 7, 1);
    d.acted = true;
    const r = run(s, { type: 'endTurn' });
    expect(r.state.units.find((u) => u.id === breacherId)!.pos).toEqual({ x: 8, y: 1 });
    const hurt = r.state.units.find((u) => u.id === d.id);
    expect(hurt === undefined || hurt.hp <= CONFIG.drones.worker.hp - CONFIG.boss.drillCrush).toBe(true);
  });

  it('an escort standing in the tunnel steps aside instead of stalling the drill', () => {
    const { s, breacherId } = arena();
    const escort = addInvader(s, 'brute', 7, 1);
    const r = run(s, { type: 'endTurn' });
    expect(r.state.units.find((u) => u.id === breacherId)!.pos).toEqual({ x: 6, y: 1 });
    expect(r.state.boss!.progress).toBe(CONFIG.boss.drillSpeed);
    expect(r.state.units.find((u) => u.id === escort.id)).toBeDefined();
  });

  it('drives down the tunnel and drains the bridge hard once it arrives', () => {
    const { s, breacherId } = arena();
    let state = s;
    for (let i = 0; i < 3; i++) state = run(state, { type: 'endTurn' }).state;
    expect(state.units.find((u) => u.id === breacherId)!.pos).toEqual({ x: 2, y: 1 });
    expect(state.bridge.max - state.bridge.integrity).toBe(CONFIG.invaders.breacher.override);
  });
});
