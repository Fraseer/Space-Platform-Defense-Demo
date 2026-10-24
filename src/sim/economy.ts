// Power (refills every turn, minus drone upkeep), matter (banked) and the deck.

import { CONFIG } from './config';
import { rngShuffle } from './rng';
import { drones, stats } from './units';
import type { GameState, Unit } from './types';

export function powerIncome(s: GameState): number {
  const generators = s.systems.filter((x) => x.kind === 'generator' && x.working).length;
  return CONFIG.power.baseIncome + generators * CONFIG.power.generatorBonus;
}

export function totalUpkeep(s: GameState): number {
  return drones(s).reduce((sum, d) => sum + stats(d).upkeep, 0);
}

/** Refills power to income − upkeep (never below 0). Returns the upkeep shortfall. */
export function refillPower(s: GameState): number {
  const income = powerIncome(s);
  const upkeep = totalUpkeep(s);
  s.power = Math.max(0, income - upkeep);
  return Math.max(0, upkeep - income);
}

/** The newest drones whose upkeep can't be paid: they start the turn browned out. */
export function brownoutDrones(s: GameState, shortfall: number): Unit[] {
  if (shortfall <= 0) return [];
  const newestFirst = drones(s).sort((a, b) => b.serial - a.serial);
  const out: Unit[] = [];
  let covered = 0;
  for (const d of newestFirst) {
    if (covered >= shortfall) break;
    const up = stats(d).upkeep;
    if (up <= 0) continue;
    out.push(d);
    covered += up;
  }
  return out;
}

export function gainMatter(s: GameState, amount: number): void {
  s.matter += amount;
  if (amount > 0) s.stats.matterGained += amount;
}

/** Draws until the hand holds `n` cards, reshuffling the discard pile when the draw pile runs out. */
export function drawUpTo(s: GameState, n: number): number {
  let drawn = 0;
  while (s.deck.hand.length < n) {
    if (s.deck.draw.length === 0) {
      if (s.deck.discard.length === 0) break;
      s.deck.draw = rngShuffle(s, s.deck.discard);
      s.deck.discard = [];
    }
    s.deck.hand.push(s.deck.draw.pop()!);
    drawn++;
  }
  return drawn;
}
