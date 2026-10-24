import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { drawUpTo, powerIncome, refillPower, totalUpkeep } from '../economy';
import { idx } from '../grid';
import { planMove } from '../pathfinding';
import { applyCommand } from '../reducer';
import { newGame } from '../setup';
import type { Command, GameState } from '../types';
import { addDrone, addInvader, testState } from './helpers';

function withHand(s: GameState, ...cardIds: string[]): number[] {
  s.deck.hand = cardIds.map((cardId, i) => ({ uid: 9000 + i, cardId }));
  return s.deck.hand.map((c) => c.uid);
}

function run(s: GameState, cmd: Command) {
  const r = applyCommand(s, cmd);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe('power and upkeep', () => {
  it('refills to income minus one upkeep per drone', () => {
    const s = newGame(7);
    expect(totalUpkeep(s)).toBe(2);
    expect(s.power).toBe(CONFIG.power.baseIncome - 2);
  });

  it('raises income when the generator is repaired', () => {
    const s = newGame(7);
    s.systems.find((x) => x.kind === 'generator')!.working = true;
    expect(powerIncome(s)).toBe(CONFIG.power.baseIncome + CONFIG.power.generatorBonus);
  });

  it('browns out the newest drones when upkeep exceeds income', () => {
    const s = newGame(7);
    for (let i = 0; i < CONFIG.power.baseIncome; i++) addDrone(s, 'worker', 1 + i, 1, 0);
    const newest = s.units.filter((u) => u.side === 'drone').sort((a, b) => b.serial - a.serial)[0];
    const oldest = s.units.find((u) => u.side === 'drone')!;
    const next = run(s, { type: 'endTurn' });
    expect(next.power).toBe(0);
    expect(next.units.find((u) => u.id === newest.id)!.ap).toBe(CONFIG.power.brownoutAp);
    expect(next.units.find((u) => u.id === oldest.id)!.ap).toBe(CONFIG.turn.apPerTurn);
  });

  it('never goes negative', () => {
    const s = testState(['.......']);
    for (let i = 0; i < 7; i++) addDrone(s, 'worker', i, 0);
    expect(refillPower(s)).toBe(7 - CONFIG.power.baseIncome);
    expect(s.power).toBe(0);
  });
});

describe('deck', () => {
  it('draws up to the hand size and reshuffles the discard pile when empty', () => {
    const s = testState(['.']);
    s.deck.draw = [{ uid: 1, cardId: 'overclock' }];
    s.deck.discard = [2, 3, 4, 5, 6].map((uid) => ({ uid, cardId: 'scan' }));
    s.deck.hand = [];
    expect(drawUpTo(s, 5)).toBe(5);
    expect(s.deck.hand).toHaveLength(5);
    expect(s.deck.draw.length + s.deck.discard.length).toBe(1);
  });

  it('keeps unplayed cards and tops up at the start of a round', () => {
    const s = newGame(3);
    const kept = s.deck.hand[0].uid;
    const next = run(s, { type: 'endTurn' });
    expect(next.deck.hand.map((c) => c.uid)).toContain(kept);
    expect(next.deck.hand).toHaveLength(CONFIG.turn.handSize);
  });
});

describe('discarding', () => {
  it('allows one free scrap per turn, refreshed each round', () => {
    const s = newGame(2);
    const [a, b] = s.deck.hand.map((c) => c.uid);
    const once = run(s, { type: 'discard', uid: a });
    expect(once.deck.discard.map((c) => c.uid)).toContain(a);
    expect(applyCommand(once, { type: 'discard', uid: b }).ok).toBe(false);
    const nextRound = run(once, { type: 'endTurn' });
    expect(nextRound.discardsLeft).toBe(CONFIG.turn.discardsPerTurn);
  });
});

describe('cards', () => {
  it('Overclock spends power and gives +1 AP', () => {
    const s = newGame(1);
    const d = s.units[0];
    const [uid] = withHand(s, 'overclock');
    const next = run(s, { type: 'playCard', uid, target: { kind: 'unit', unitId: d.id } });
    expect(next.units[0].ap).toBe(3);
    expect(next.power).toBe(s.power - CONFIG.cards.overclock.power);
    expect(next.deck.discard.some((c) => c.uid === uid)).toBe(true);
  });

  it('refuses cards you cannot afford', () => {
    const s = newGame(1);
    s.power = 0;
    const [uid] = withHand(s, 'overclock');
    expect(applyCommand(s, { type: 'playCard', uid, target: { kind: 'unit', unitId: s.units[0].id } }).ok).toBe(false);
  });

  it('Fabricate builds a drone next to the fabricator and costs matter', () => {
    const s = newGame(1);
    s.matter = 20;
    const [uid] = withHand(s, 'fabricateSentry');
    const next = run(s, { type: 'playCard', uid, target: { kind: 'none' } });
    const fab = s.systems.find((x) => x.kind === 'fabricator')!;
    const built = next.units.filter((u) => u.side === 'drone')[2];
    expect(built.type).toBe('sentry');
    expect(Math.max(Math.abs(built.pos.x - fab.pos.x), Math.abs(built.pos.y - fab.pos.y))).toBe(1);
    expect(built.ap).toBe(CONFIG.turn.fabricatedAp);
    expect(next.matter).toBe(20 - CONFIG.drones.sentry.matterCost);
  });

  it('Emergency Bulkhead blocks movement for its duration', () => {
    const s = testState(['#####', '#.+.#', '#####']);
    s.power = 5;
    const d = addDrone(s, 'sentry', 1, 1);
    const [uid] = withHand(s, 'emergencyBulkhead');
    let next = run(s, { type: 'playCard', uid, target: { kind: 'door', pos: { x: 2, y: 1 } } });
    expect(planMove(next, next.units[0], { x: 3, y: 1 })).toBeNull();
    for (let i = 0; i < CONFIG.cards.emergencyBulkhead.rounds; i++) next = run(next, { type: 'endTurn' });
    expect(planMove(next, next.units.find((u) => u.id === d.id)!, { x: 3, y: 1 })).not.toBeNull();
  });

  it('Vent Section kills everything in the room, drones included, and exhausts', () => {
    const s = testState(['#######', '#..#..#', '#######'], {
      zones: [
        { id: 'a', name: 'A', kind: 'room', rect: [1, 1, 2, 1] },
        { id: 'b', name: 'B', kind: 'room', rect: [4, 1, 5, 1] },
      ],
    });
    s.power = 5;
    const mine = addDrone(s, 'sentry', 1, 1);
    const safe = addDrone(s, 'sentry', 4, 1);
    const enemy = addInvader(s, 'brute', 2, 1);
    const [uid] = withHand(s, 'ventSection');
    const next = run(s, { type: 'playCard', uid, target: { kind: 'zone', zone: 0 } });
    const ids = next.units.map((u) => u.id);
    expect(ids).not.toContain(mine.id);
    expect(ids).not.toContain(enemy.id);
    expect(ids).toContain(safe.id);
    expect(next.deck.exhausted.map((c) => c.uid)).toEqual([uid]);
    expect(next.stats.dronesLost).toBe(1);
  });

  it('Recycle scraps a drone for half its matter cost', () => {
    const s = newGame(1);
    const worker = s.units.find((u) => u.type === 'worker')!;
    const [uid] = withHand(s, 'recycle');
    const next = run(s, { type: 'playCard', uid, target: { kind: 'unit', unitId: worker.id } });
    expect(next.units.find((u) => u.id === worker.id)).toBeUndefined();
    expect(next.matter).toBe(s.matter + Math.floor(CONFIG.drones.worker.matterCost * CONFIG.cards.recycle.refundRatio));
  });

  it('Field Repair heals a damaged drone and refuses an undamaged one', () => {
    const s = newGame(1);
    const d = s.units[0];
    const [uid] = withHand(s, 'fieldRepair');
    expect(applyCommand(s, { type: 'playCard', uid, target: { kind: 'unit', unitId: d.id } }).ok).toBe(false);
    s.units[0].hp = 2;
    const next = run(s, { type: 'playCard', uid, target: { kind: 'unit', unitId: d.id } });
    expect(next.units[0].hp).toBe(2 + CONFIG.cards.fieldRepair.heal);
  });

  it('Reroute Power adds power this turn', () => {
    const s = newGame(1);
    const [uid] = withHand(s, 'reroutePower');
    expect(run(s, { type: 'playCard', uid, target: { kind: 'none' } }).power).toBe(s.power + CONFIG.cards.reroutePower.gain);
  });
});

describe('worker actions', () => {
  it('salvages matter from a spot until it runs out', () => {
    const s = newGame(1);
    const spot = s.salvage[0];
    const w = s.units.find((u) => u.type === 'worker')!;
    w.pos = { ...spot.pos };
    w.ap = 5;
    let next = s;
    for (let i = 0; i < CONFIG.worker.salvageCharges; i++) next = run(next, { type: 'salvage', unitId: w.id, spotId: spot.id });
    expect(next.matter).toBe(s.matter + CONFIG.worker.salvageCharges * CONFIG.worker.salvageYield);
    expect(applyCommand(next, { type: 'salvage', unitId: w.id, spotId: spot.id }).ok).toBe(false);
  });

  it('repairs the generator next to it for matter; Sentries cannot', () => {
    const s = newGame(1);
    const gen = s.systems.find((x) => x.kind === 'generator')!;
    const w = s.units.find((u) => u.type === 'worker')!;
    const sentry = s.units.find((u) => u.type === 'sentry')!;
    w.pos = { x: gen.pos.x - 1, y: gen.pos.y };
    sentry.pos = { x: gen.pos.x + 1, y: gen.pos.y };
    s.matter = 10;
    expect(applyCommand(s, { type: 'repair', unitId: sentry.id, systemId: gen.id }).ok).toBe(false);
    const next = run(s, { type: 'repair', unitId: w.id, systemId: gen.id });
    expect(next.systems.find((x) => x.id === gen.id)!.working).toBe(true);
    expect(next.matter).toBe(10 - CONFIG.worker.repairCost.generator);
    expect(next.tiles[idx(next, gen.pos)]).toBe('system');
  });
});
