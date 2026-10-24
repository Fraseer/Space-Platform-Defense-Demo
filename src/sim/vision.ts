// What the ship and the invaders can see. Milestone 4: every tile is lit.
// Darkness, sensors and blips arrive in milestone 5.

import { CONFIG } from './config';
import { distance, hasLineOfSight } from './grid';
import type { GameState, Vec } from './types';

export function isLit(_s: GameState, _p: Vec): boolean {
  return true;
}

export function shipCanSee(_s: GameState, _p: Vec): boolean {
  return true;
}

/** Invaders need light: in the dark (theirs or the target's) they only see a few tiles. */
export function invaderCanSee(s: GameState, from: Vec, to: Vec): boolean {
  const range = isLit(s, from) && isLit(s, to) ? CONFIG.vision.invaderLitVision : CONFIG.vision.invaderDarkVision;
  return distance(from, to) <= range && hasLineOfSight(s, from, to);
}

/** Aim invaders lose when they or their target stand in the dark. */
export function invaderAimPenaltyFromDark(s: GameState, from: Vec, to: Vec): number {
  return isLit(s, from) && isLit(s, to) ? 0 : CONFIG.combat.invaderDarkPenalty;
}
