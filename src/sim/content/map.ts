// The hand-made command deck. Edit the ASCII to change the layout; the map
// test checks that every floor tile belongs to a zone and that every airlock
// can reach the bridge.
//
// Legend
//   #  wall              .  floor              +  door
//   h  half cover        H  full cover         $  salvage spot (floor)
//   F  fabricator        G  generator          1 2 3  lighting relays
//   b  bridge floor      K  AI core (bridge)   A B C  airlocks (in the hull)
//
// Rings, outside in: hull rooms with airlocks (band 1–3) → systems ring
// (band 5–7) → inner ring corridor (9/15) → bridge (11–13). Each ring is a
// loop, and the gates between rings are staggered so there is no straight run
// from the hull to the centre:
//   hull → systems     only at the four corners (cargo, crew, airlock C, shop)
//   systems → inner    only on the west and east sides (through the relay rooms)
//   inner → bridge     only on the north and south sides
// so every route has to work its way round each ring in turn.

export type Ring = 'hull' | 'systems' | 'inner' | 'core';

export interface ZoneDef {
  id: string;
  name: string;
  kind: 'room' | 'corridor' | 'bridge';
  /** Which ring of the deck the zone belongs to; doors may only join neighbouring rings (checked by the map test). */
  ring?: Ring;
  /** Inclusive rectangle [x1, y1, x2, y2]. */
  rect: [number, number, number, number];
}

export interface MapDef {
  name: string;
  rows: string[];
  zones: ZoneDef[];
  /** Zones lit from the start, whatever the relays do. */
  alwaysLit: string[];
  /** Relay digit → zones it lights once repaired. */
  relays: Record<string, { name: string; lights: string[] }>;
  airlocks: Record<string, string>;
  /** Where the act starts its drones. */
  droneStarts: [number, number][];
}

export const COMMAND_DECK: MapDef = {
  name: 'Command Deck',
  rows: [
    '##########A##############', // 0
    '#.....$.#.......#.h.h..$#', // 1
    '#.hH....+..h.h..+.......#', // 2
    '#.......#.......#h...h..#', // 3
    '##+###+###########+###+##', // 4
    '#...#....h.#.#.h....#...#', // 5
    '#.$.#..F...+.+...G..#.h.#', // 6
    '#...#..h...#.#...h..#...#', // 7
    '#...##+###########+##...B', // 8
    '#...#...#.......#...#...#', // 9
    '#...#1..#.##+##.#..2#...#', // 10
    '#...#...#.#bbb#.#...#...#', // 11
    '##+##...+.#bKb#.+...##+##', // 12
    '#...#...#.#bbb#.#...#...#', // 13
    '#...#..h#.##+##.#h..#...#', // 14
    '#...#...#.......#...#...#', // 15
    '#...##+###########+##...#', // 16
    '#...#..h...#.#...h..#...#', // 17
    '#.$.#3.....+.+...$..#.$.#', // 18
    '#...#....h.#.#.h....#...#', // 19
    '##+###+###########+###+##', // 20
    '#.......#..H.h..#...H...#', // 21
    '#.h.h...+.......+.$...h.#', // 22
    '#.....h.#..$.$..#.......#', // 23
    '####C####################', // 24
  ],
  zones: [
    { id: 'cargo', name: 'Cargo Hold', kind: 'room', ring: 'hull', rect: [1, 1, 7, 3] },
    { id: 'airlockA', name: 'Airlock A Bay', kind: 'room', ring: 'hull', rect: [9, 1, 15, 3] },
    { id: 'crew', name: 'Crew Quarters', kind: 'room', ring: 'hull', rect: [17, 1, 23, 3] },
    { id: 'medbay', name: 'Med Bay', kind: 'room', ring: 'hull', rect: [1, 5, 3, 11] },
    { id: 'fab', name: 'Fabrication Bay', kind: 'room', ring: 'systems', rect: [5, 5, 10, 7] },
    { id: 'passageN', name: 'North Passage', kind: 'corridor', ring: 'systems', rect: [12, 5, 12, 7] },
    { id: 'gen', name: 'Generator Room', kind: 'room', ring: 'systems', rect: [14, 5, 19, 7] },
    { id: 'airlockB', name: 'Airlock B Bay', kind: 'room', ring: 'hull', rect: [21, 5, 23, 11] },
    { id: 'relayW', name: 'West Relay', kind: 'room', ring: 'systems', rect: [5, 9, 7, 15] },
    { id: 'ringN', name: 'Ring North', kind: 'corridor', ring: 'inner', rect: [9, 9, 15, 9] },
    { id: 'ringW', name: 'Ring West', kind: 'corridor', ring: 'inner', rect: [9, 10, 9, 14] },
    { id: 'bridge', name: 'Bridge', kind: 'bridge', ring: 'core', rect: [11, 11, 13, 13] },
    { id: 'ringE', name: 'Ring East', kind: 'corridor', ring: 'inner', rect: [15, 10, 15, 14] },
    { id: 'relayE', name: 'East Relay', kind: 'room', ring: 'systems', rect: [17, 9, 19, 15] },
    { id: 'ringS', name: 'Ring South', kind: 'corridor', ring: 'inner', rect: [9, 15, 15, 15] },
    { id: 'archive', name: 'Archive', kind: 'room', ring: 'hull', rect: [1, 13, 3, 19] },
    { id: 'maint', name: 'Maintenance', kind: 'room', ring: 'hull', rect: [21, 13, 23, 19] },
    { id: 'relayS', name: 'South Relay', kind: 'room', ring: 'systems', rect: [5, 17, 10, 19] },
    { id: 'passageS', name: 'South Passage', kind: 'corridor', ring: 'systems', rect: [12, 17, 12, 19] },
    { id: 'depot', name: 'Supply Depot', kind: 'room', ring: 'systems', rect: [14, 17, 19, 19] },
    { id: 'airlockC', name: 'Airlock C Bay', kind: 'room', ring: 'hull', rect: [1, 21, 7, 23] },
    { id: 'hangar', name: 'Hangar', kind: 'room', ring: 'hull', rect: [9, 21, 15, 23] },
    { id: 'shop', name: 'Machine Shop', kind: 'room', ring: 'hull', rect: [17, 21, 23, 23] },
  ],
  alwaysLit: ['bridge', 'fab'],
  relays: {
    '1': { name: 'West Relay', lights: ['relayW', 'ringW', 'ringN', 'medbay', 'archive', 'cargo'] },
    '2': { name: 'East Relay', lights: ['relayE', 'ringE', 'gen', 'passageN', 'airlockA', 'crew', 'airlockB', 'maint'] },
    '3': { name: 'South Relay', lights: ['relayS', 'ringS', 'passageS', 'depot', 'hangar', 'airlockC', 'shop'] },
  },
  airlocks: { A: 'Airlock A', B: 'Airlock B', C: 'Airlock C' },
  droneStarts: [
    [11, 13],
    [13, 11],
  ],
};
