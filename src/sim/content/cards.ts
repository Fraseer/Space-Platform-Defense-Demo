// Cards are the ship AI's commands, defined as data: a cost, what they target,
// and a list of small effects run by effects.ts. Numbers come from config.ts.

import { CONFIG } from '../config';
import { MODULES } from './modules';
import type { DroneType } from '../types';

export type CardType = 'fabricate' | 'tactical' | 'system' | 'module';

/** What the player clicks to play the card. */
export type TargetKind = 'none' | 'drone' | 'door' | 'zone' | 'room' | 'tile';

export type StatusKind = 'aimBonus' | 'disableNext';

export type Effect =
  | { kind: 'gainPower'; amount: number }
  | { kind: 'gainAp'; amount: number }
  | { kind: 'applyStatus'; status: StatusKind; value: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'spawn'; drone: DroneType }
  | { kind: 'seal'; rounds: number }
  | { kind: 'darken'; rounds: number }
  | { kind: 'vent' }
  | { kind: 'scan'; radius: number }
  | { kind: 'recycle'; refundRatio: number }
  | { kind: 'installModule'; module: string };

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  cost: { power: number; matter?: number };
  target: TargetKind;
  effects: Effect[];
  /** Removed from the deck once played. */
  exhaust?: boolean;
  text: string;
}

const K = CONFIG.cards;

const BASE_CARDS: CardDef[] = [
  {
    id: 'fabricateSentry',
    name: 'Fabricate Sentry',
    type: 'fabricate',
    cost: { power: K.fabricateSentry.power, matter: CONFIG.drones.sentry.matterCost },
    target: 'none',
    effects: [{ kind: 'spawn', drone: 'sentry' }],
    text: `Build a Sentry at the fabricator. It arrives with ${CONFIG.turn.fabricatedAp} AP.`,
  },
  {
    id: 'fabricateWorker',
    name: 'Fabricate Worker',
    type: 'fabricate',
    cost: { power: K.fabricateWorker.power, matter: CONFIG.drones.worker.matterCost },
    target: 'none',
    effects: [{ kind: 'spawn', drone: 'worker' }],
    text: `Build a Worker at the fabricator. It arrives with ${CONFIG.turn.fabricatedAp} AP.`,
  },
  {
    id: 'overclock',
    name: 'Overclock',
    type: 'tactical',
    cost: { power: K.overclock.power },
    target: 'drone',
    effects: [{ kind: 'gainAp', amount: K.overclock.ap }],
    text: `A drone gets +${K.overclock.ap} AP this turn.`,
  },
  {
    id: 'targetingUplink',
    name: 'Targeting Uplink',
    type: 'tactical',
    cost: { power: K.targetingUplink.power },
    target: 'drone',
    effects: [{ kind: 'applyStatus', status: 'aimBonus', value: K.targetingUplink.aim }],
    text: `+${K.targetingUplink.aim}% aim on the drone's next shot this turn.`,
  },
  {
    id: 'emergencyBulkhead',
    name: 'Emergency Bulkhead',
    type: 'system',
    cost: { power: K.emergencyBulkhead.power },
    target: 'door',
    effects: [{ kind: 'seal', rounds: K.emergencyBulkhead.rounds }],
    text: `Seal a door for ${K.emergencyBulkhead.rounds} rounds. Blocks movement and sight; invaders re-route.`,
  },
  {
    id: 'killTheLights',
    name: 'Kill the Lights',
    type: 'system',
    cost: { power: K.killTheLights.power },
    target: 'zone',
    effects: [{ kind: 'darken', rounds: K.killTheLights.rounds }],
    text: `Darken a room or corridor for ${K.killTheLights.rounds} rounds. Invaders in the dark lose aim and vision.`,
  },
  {
    id: 'ventSection',
    name: 'Vent Section',
    type: 'system',
    cost: { power: K.ventSection.power },
    target: 'room',
    effects: [{ kind: 'vent' }],
    exhaust: true,
    text: 'Vent a room into space. Kills everything inside — your drones too. Not the bridge. Exhaust.',
  },
  {
    id: 'reroutePower',
    name: 'Reroute Power',
    type: 'system',
    cost: { power: K.reroutePower.power },
    target: 'none',
    effects: [{ kind: 'gainPower', amount: K.reroutePower.gain }],
    text: `+${K.reroutePower.gain} power this turn.`,
  },
  {
    id: 'recycle',
    name: 'Recycle',
    type: 'system',
    cost: { power: K.recycle.power },
    target: 'drone',
    effects: [{ kind: 'recycle', refundRatio: K.recycle.refundRatio }],
    text: `Scrap a drone for ${Math.round(K.recycle.refundRatio * 100)}% of its matter cost.`,
  },
  {
    id: 'scan',
    name: 'Scan',
    type: 'system',
    cost: { power: K.scan.power },
    target: 'tile',
    effects: [{ kind: 'scan', radius: K.scan.radius }],
    text: `Reveal every contact within ${K.scan.radius} tiles until your next turn.`,
  },
  {
    id: 'disableShot',
    name: 'Disable Shot',
    type: 'tactical',
    cost: { power: K.disableShot.power },
    target: 'drone',
    effects: [{ kind: 'applyStatus', status: 'disableNext', value: 1 }],
    text: "The drone's next lethal shot leaves a husk instead of a corpse. Haul it to the fabricator for tech.",
  },
  {
    id: 'fieldRepair',
    name: 'Field Repair',
    type: 'tactical',
    cost: { power: K.fieldRepair.power, matter: K.fieldRepair.matter },
    target: 'drone',
    effects: [{ kind: 'heal', amount: K.fieldRepair.heal }],
    text: `Restore ${K.fieldRepair.heal} HP to a damaged drone.`,
  },
];

/** Module cards are generated from the module list: install permanently, then exhaust. */
const MODULE_CARDS: CardDef[] = Object.values(MODULES).map((m) => ({
  id: `module:${m.id}`,
  name: m.name,
  type: 'module',
  cost: { power: K.module.power },
  target: 'drone',
  effects: [{ kind: 'installModule', module: m.id }],
  exhaust: true,
  text: `Install on a drone permanently: ${m.text}`,
}));

export const CARDS: Record<string, CardDef> = Object.fromEntries([...BASE_CARDS, ...MODULE_CARDS].map((c) => [c.id, c]));
