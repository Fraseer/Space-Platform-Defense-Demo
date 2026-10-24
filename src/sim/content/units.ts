// Drone chassis and invader archetypes as data. Numbers live in config.ts.

import type { DroneType, InvaderType } from '../types';

export type DroneAbility = 'shoot' | 'overwatch' | 'repair' | 'salvage' | 'haul';

export interface DroneDef {
  name: string;
  /** Serial-number prefix, e.g. SEN-4471. */
  prefix: string;
  abilities: DroneAbility[];
  blurb: string;
}

export const DRONES: Record<DroneType, DroneDef> = {
  sentry: {
    name: 'Sentry',
    prefix: 'SEN',
    abilities: ['shoot', 'overwatch'],
    blurb: 'Combat chassis. Good aim, long range.',
  },
  worker: {
    name: 'Worker',
    prefix: 'WRK',
    abilities: ['shoot', 'overwatch', 'repair', 'salvage', 'haul'],
    blurb: 'Repairs systems, salvages matter, hauls husks. Weak gun.',
  },
};

/** What an invader is trying to reach. */
export type InvaderGoal = 'bridge' | 'hunt' | 'sabotage' | 'drill' | 'none';

export interface InvaderDef {
  name: string;
  goal: InvaderGoal;
  blurb: string;
  /** Immune to Vent Section. */
  anchored?: boolean;
}

export const INVADERS: Record<InvaderType, InvaderDef> = {
  runner: { name: 'Runner', goal: 'bridge', blurb: 'Fast and fragile. Beelines for the bridge.' },
  brute: { name: 'Brute', goal: 'hunt', blurb: 'Tank. Hunts drones it can see.' },
  saboteur: { name: 'Saboteur', goal: 'sabotage', blurb: 'Breaks systems you have repaired.' },
  breacher: { name: 'Siege Breacher', goal: 'drill', blurb: 'Boss. Drills a tunnel straight at the bridge.', anchored: true },
  rig: { name: 'Drill Rig', goal: 'none', blurb: 'Powers the Breacher\'s drill. Destroy it to stop the drill.', anchored: true },
};
