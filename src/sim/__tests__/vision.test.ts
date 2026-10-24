import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { canTarget, previewShot } from '../combat';
import { applyCommand } from '../reducer';
import { newGame } from '../setup';
import { decide } from '../ai';
import { invaderCanSee, isLit, shipCanSee } from '../vision';
import type { GameState } from '../types';
import { addDrone, addInvader, testState } from './helpers';

/** Two rooms joined by a doorway: west is lit by a relay (when working), east is dark. */
function twoRooms(): GameState {
  return testState(
    [
      '#####################',
      '#.........+.........#',
      '#1........#.........#',
      '#.........#.........#',
      '#####################',
    ],
    {
      zones: [
        { id: 'west', name: 'West', kind: 'room', rect: [1, 1, 9, 3] },
        { id: 'east', name: 'East', kind: 'room', rect: [11, 1, 19, 3] },
      ],
      alwaysLit: [],
      relays: { '1': { name: 'Relay', lights: ['west'] } },
    },
  );
}

describe('lighting', () => {
  it('rooms are dark until a working relay lights them', () => {
    const s = twoRooms();
    expect(isLit(s, { x: 5, y: 2 })).toBe(false);
    s.systems[0].working = true;
    expect(isLit(s, { x: 5, y: 2 })).toBe(true);
    expect(isLit(s, { x: 15, y: 2 })).toBe(false);
    expect(isLit(s, { x: 10, y: 1 })).toBe(true); // the door takes light from the lit side
  });

  it('the bridge and fabrication bay start lit; the rest of the deck is dark', () => {
    const s = newGame(1);
    const lit = s.zones.filter((_, i) => isLit(s, { x: s.zoneOf.indexOf(i) % s.width, y: Math.floor(s.zoneOf.indexOf(i) / s.width) }));
    expect(lit.map((z) => z.id).sort()).toEqual(['bridge', 'fab']);
  });

  it('Kill the Lights darkens a lit zone for its duration, then the light returns', () => {
    const s = twoRooms();
    s.systems[0].working = true;
    s.power = 5;
    s.breaches = [{ index: 0, airlock: 'A', warnRound: 1, arriveRound: 99, units: [], announced: true, arrived: false, boss: false }];
    s.deck.hand = [{ uid: 500, cardId: 'killTheLights' }];
    let r = applyCommand(s, { type: 'playCard', uid: 500, target: { kind: 'zone', zone: 0 } });
    expect(isLit(r.state, { x: 5, y: 2 })).toBe(false);
    for (let i = 0; i < CONFIG.cards.killTheLights.rounds; i++) r = applyCommand(r.state, { type: 'endTurn' });
    expect(isLit(r.state, { x: 5, y: 2 })).toBe(true);
  });

  it('a Worker repairing a relay lights its zones', () => {
    const s = newGame(1);
    const relay = s.systems.find((x) => x.kind === 'relay')!;
    const w = s.units.find((u) => u.type === 'worker')!;
    w.pos = { x: relay.pos.x + 1, y: relay.pos.y };
    s.matter = 10;
    const zone = relay.lights[0];
    const tile = s.zoneOf.indexOf(zone);
    const p = { x: tile % s.width, y: Math.floor(tile / s.width) };
    expect(isLit(s, p)).toBe(false);
    const r = applyCommand(s, { type: 'repair', unitId: w.id, systemId: relay.id });
    expect(isLit(r.state, p)).toBe(true);
  });
});

describe('ship vision and blips', () => {
  it('sees lit tiles without line of sight', () => {
    const s = twoRooms();
    s.systems[0].working = true;
    expect(shipCanSee(s, { x: 8, y: 3 })).toBe(true);
  });

  it('sees dark tiles only within a drone sensor radius and line of sight', () => {
    const s = twoRooms();
    addDrone(s, 'sentry', 12, 2); // sensor 5
    expect(shipCanSee(s, { x: 16, y: 2 })).toBe(true);
    expect(shipCanSee(s, { x: 18, y: 2 })).toBe(false);
    expect(shipCanSee(s, { x: 8, y: 2 })).toBe(false); // behind the wall
  });

  it('cannot target a blip, but can once a Scan reveals it', () => {
    const s = twoRooms();
    const d = addDrone(s, 'sentry', 11, 2);
    const inv = addInvader(s, 'runner', 18, 2);
    expect(canTarget(s, d, inv)).toBe(false);
    s.power = 5;
    s.deck.hand = [{ uid: 600, cardId: 'scan' }];
    const r = applyCommand(s, { type: 'playCard', uid: 600, target: { kind: 'tile', pos: { x: 17, y: 2 } } });
    expect(canTarget(r.state, r.state.units[0], r.state.units[1])).toBe(true);
  });

  it('flags invader steps the ship cannot see as unseen in move events', () => {
    const s = twoRooms();
    s.systems[0].working = true;
    addDrone(s, 'sentry', 1, 1, 0).acted = true;
    const inv = addInvader(s, 'runner', 19, 2);
    // Make the west room count as the bridge so the runner walks there.
    s.zones[0].kind = 'bridge';
    s.bridgeTiles = s.zoneOf.map((z, i) => (z === 0 && s.tiles[i] === 'floor' ? i : -1)).filter((i) => i >= 0);
    s.breaches = [{ index: 0, airlock: 'A', warnRound: 1, arriveRound: 99, units: [], announced: true, arrived: false, boss: false }];
    const r = applyCommand(s, { type: 'endTurn' });
    const moves = r.events.filter((e) => e.type === 'unitMoved' && e.unitId === inv.id);
    const seen = moves.flatMap((e) => (e.type === 'unitMoved' ? e.seen ?? [] : []));
    expect(seen.some((v) => v === false)).toBe(true); // dark east room
    expect(seen.some((v) => v === true)).toBe(true); // lit west room
  });
});

describe('invaders in the dark', () => {
  it('lose aim when they or their target are in the dark', () => {
    const s = twoRooms();
    const d = addDrone(s, 'sentry', 14, 2);
    const inv = addInvader(s, 'brute', 12, 2);
    const dark = previewShot(s, inv, d).chance;
    s.zones[1].alwaysLit = true;
    const lit = previewShot(s, inv, d).chance;
    expect(lit - dark).toBe(CONFIG.combat.invaderDarkPenalty);
  });

  it('only see a few tiles in the dark', () => {
    const s = twoRooms();
    const far = { x: 12 + CONFIG.vision.invaderDarkVision + 2, y: 2 };
    expect(invaderCanSee(s, { x: 12, y: 2 }, far)).toBe(false);
    s.zones[1].alwaysLit = true;
    expect(invaderCanSee(s, { x: 12, y: 2 }, far)).toBe(true);
  });

  it('a Brute in the dark has no shot on a drone it cannot see', () => {
    const s = twoRooms();
    addDrone(s, 'sentry', 18, 2);
    const b = addInvader(s, 'brute', 12, 2);
    expect(decide(s, b).action).toBeNull();
    s.zones[1].alwaysLit = true;
    expect(decide(s, b).action?.kind).toBe('shoot');
  });
});
