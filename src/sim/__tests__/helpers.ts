// Test helpers: build small hand-made maps and units without the full game setup.

import { loadMap } from '../setup';
import { createDrone, createInvader } from '../units';
import type { MapDef } from '../content/map';
import type { DroneType, GameState, InvaderType } from '../types';

/** A GameState from ASCII rows. Every non-wall tile goes into one big room zone. */
export function testState(rows: string[], extra: Partial<MapDef> = {}): GameState {
  const map: MapDef = {
    name: 'test',
    rows,
    zones: [{ id: 'room', name: 'Room', kind: 'room', rect: [0, 0, rows[0].length - 1, rows.length - 1] }],
    alwaysLit: ['room'],
    relays: {},
    airlocks: {},
    droneStarts: [],
    ...extra,
  };
  const loaded = loadMap(map);
  return {
    seed: 1,
    rng: 1,
    round: 1,
    status: 'playing',
    outcome: '',
    ...loaded,
    bridgeTiles: loaded.bridgeTiles,
    units: [],
    husks: [],
    power: 5,
    matter: 10,
    deck: { draw: [], hand: [], discard: [], exhausted: [] },
    bridge: { integrity: 20, max: 20 },
    breaches: [],
    boss: null,
    scans: [],
    pendingChoice: null,
    stats: { kills: 0, dronesLost: 0, dronesBuilt: 0, husksCaptured: 0, matterGained: 0, cardsPlayed: 0 },
  };
}

export function addDrone(s: GameState, type: DroneType, x: number, y: number, ap = 2) {
  const d = createDrone(s, type, { x, y });
  d.ap = ap;
  s.units.push(d);
  return d;
}

export function addInvader(s: GameState, type: InvaderType, x: number, y: number) {
  const u = createInvader(s, type, { x, y });
  u.ap = 2;
  s.units.push(u);
  return u;
}
