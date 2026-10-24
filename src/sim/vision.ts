// What the ship can see. Milestone 2: everything is visible. Darkness, sensors
// and blips arrive in milestone 5.

import type { GameState, Vec } from './types';

export function shipCanSee(_s: GameState, _p: Vec): boolean {
  return true;
}

/** Aim invaders lose when they or their target stand in the dark. */
export function invaderAimPenaltyFromDark(_s: GameState, _from: Vec, _to: Vec): number {
  return 0;
}
