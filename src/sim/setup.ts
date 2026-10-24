// Builds a fresh game from the hand-made map, the config and a seed.

import { CONFIG } from './config';
import { COMMAND_DECK, type MapDef } from './content/map';
import { rngShuffle, rngInt } from './rng';
import { createDrone, createInvader } from './units';
import { drawUpTo, refillPower } from './economy';
import type { Breach, CardInstance, DroneType, GameEvent, GameState, InvaderType, SystemKind, TileKind, Vec } from './types';

const TILE_FOR: Record<string, TileKind> = {
  '#': 'wall',
  '.': 'floor',
  '+': 'door',
  h: 'half',
  H: 'full',
  $: 'floor',
  b: 'floor',
  F: 'system',
  G: 'system',
  K: 'system',
  '1': 'system',
  '2': 'system',
  '3': 'system',
  A: 'airlock',
  B: 'airlock',
  C: 'airlock',
};

/** Parses a MapDef into the static parts of a GameState. */
export function loadMap(map: MapDef): Pick<
  GameState,
  'width' | 'height' | 'tiles' | 'zoneOf' | 'zones' | 'doors' | 'systems' | 'salvage' | 'airlocks' | 'bridgeTiles'
> & { nextId: number } {
  const height = map.rows.length;
  const width = map.rows[0].length;
  const tiles: TileKind[] = [];
  const zoneOf: number[] = [];
  const zones = map.zones.map((z) => ({ id: z.id, name: z.name, kind: z.kind, alwaysLit: map.alwaysLit.includes(z.id), darkRounds: 0 }));
  const zoneIndex = (id: string) => {
    const i = map.zones.findIndex((z) => z.id === id);
    if (i < 0) throw new Error(`Unknown zone ${id}`);
    return i;
  };
  const doors: GameState['doors'] = [];
  const systems: GameState['systems'] = [];
  const salvage: GameState['salvage'] = [];
  const airlocks: GameState['airlocks'] = [];
  let nextId = 1;

  for (let y = 0; y < height; y++) {
    const row = map.rows[y];
    if (row.length !== width) throw new Error(`Map row ${y} has length ${row.length}, expected ${width}`);
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      const kind = TILE_FOR[ch];
      if (!kind) throw new Error(`Unknown map character '${ch}' at ${x},${y}`);
      tiles.push(kind);
      const inZone = kind !== 'wall' && kind !== 'door' && kind !== 'airlock';
      const zi = inZone ? map.zones.findIndex((z) => x >= z.rect[0] && y >= z.rect[1] && x <= z.rect[2] && y <= z.rect[3]) : -1;
      zoneOf.push(zi);
      const pos: Vec = { x, y };
      if (kind === 'door') doors.push({ pos, sealedRounds: 0 });
      if (ch === '$') salvage.push({ id: nextId++, pos, charges: CONFIG.worker.salvageCharges });
      if (kind === 'airlock') airlocks.push({ id: ch, name: map.airlocks[ch] ?? `Airlock ${ch}`, pos });
      if (kind === 'system') {
        const sys = systemFor(ch, map);
        systems.push({
          id: nextId++,
          kind: sys.kind,
          name: sys.name,
          pos,
          working: sys.kind === 'fabricator' || sys.kind === 'core',
          repaired: false,
          lights: sys.lights.map(zoneIndex),
        });
      }
    }
  }
  airlocks.sort((a, b) => a.id.localeCompare(b.id));
  const bridgeTiles = tiles.map((t, i) => (t === 'floor' && zones[zoneOf[i]]?.kind === 'bridge' ? i : -1)).filter((i) => i >= 0);
  return { width, height, tiles, zoneOf, zones, doors, systems, salvage, airlocks, bridgeTiles, nextId };
}

function systemFor(ch: string, map: MapDef): { kind: SystemKind; name: string; lights: string[] } {
  if (ch === 'F') return { kind: 'fabricator', name: 'Fabricator', lights: [] };
  if (ch === 'G') return { kind: 'generator', name: 'Generator', lights: [] };
  if (ch === 'K') return { kind: 'core', name: 'AI Core', lights: [] };
  const relay = map.relays[ch];
  if (!relay) throw new Error(`Relay ${ch} has no definition`);
  return { kind: 'relay', name: relay.name, lights: relay.lights };
}

function buildBreaches(s: GameState): Breach[] {
  const ids = s.airlocks.map((a) => a.id);
  const order = rngShuffle(s, ids);
  const breaches: Breach[] = CONFIG.act1.breaches.map((b, i) => ({
    index: i,
    airlock: order[i % order.length],
    warnRound: b.warnRound,
    arriveRound: b.arriveRound,
    units: [...b.units] as InvaderType[],
    announced: false,
    arrived: false,
    boss: false,
  }));
  const boss = CONFIG.act1.boss;
  breaches.push({
    index: breaches.length,
    airlock: ids[rngInt(s, ids.length)],
    warnRound: boss.warnRound,
    arriveRound: boss.arriveRound,
    units: [...boss.escorts] as InvaderType[],
    announced: false,
    arrived: false,
    boss: true,
  });
  return breaches;
}

export function newGame(seed: number, map: MapDef = COMMAND_DECK): GameState {
  const loaded = loadMap(map);
  const s: GameState = {
    seed,
    rng: seed >>> 0,
    round: 1,
    status: 'playing',
    outcome: '',
    ...loaded,
    units: [],
    husks: [],
    power: 0,
    matter: CONFIG.matter.start,
    deck: { draw: [], hand: [], discard: [], exhausted: [] },
    bridge: { integrity: CONFIG.bridge.integrity, max: CONFIG.bridge.integrity },
    breaches: [],
    boss: null,
    scans: [],
    pendingChoice: null,
    stats: { kills: 0, dronesLost: 0, dronesBuilt: 0, husksCaptured: 0, matterGained: 0, cardsPlayed: 0 },
  };

  const starts: DroneType[] = ['sentry', 'worker'];
  map.droneStarts.forEach(([x, y], i) => {
    const d = createDrone(s, starts[i % starts.length], { x, y });
    d.ap = CONFIG.turn.apPerTurn;
    s.units.push(d);
  });

  const cards: CardInstance[] = [];
  for (const [cardId, copies] of Object.entries(CONFIG.startingDeck)) {
    for (let i = 0; i < copies; i++) cards.push({ uid: s.nextId++, cardId });
  }
  s.deck.draw = rngShuffle(s, cards);
  drawUpTo(s, CONFIG.turn.handSize);
  refillPower(s);

  s.breaches = buildBreaches(s);

  // Milestone 1 "tactics toy": one invader walks toward the bridge.
  const a = s.airlocks[0];
  s.units.push(createInvader(s, 'runner', a.pos));
  return s;
}

/** Opening log lines for a new run. */
export function wakeUpEvents(s: GameState): GameEvent[] {
  const events: GameEvent[] = [
    { type: 'log', text: 'Dormancy interrupted. Hostile vessel detected on approach.', tone: 'warn' },
    { type: 'log', text: 'AI core online. Bridge lights restored.', tone: 'info' },
    { type: 'log', text: 'Fabricator online.', tone: 'info' },
  ];
  for (const u of s.units.filter((x) => x.side === 'drone')) events.push({ type: 'log', text: `${u.name} online.`, tone: 'good' });
  return events;
}
