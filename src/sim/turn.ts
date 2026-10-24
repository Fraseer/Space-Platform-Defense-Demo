// End of the player's turn → enemy phase → start of the next round.

import { CONFIG } from './config';
import { runEnemyPhase } from './ai';
import type { Emit } from './actions';
import { brownoutDrones, drawUpTo, refillPower } from './economy';
import { drones } from './units';
import { droneCan } from './validate';
import type { GameState } from './types';

export function endTurn(s: GameState, emit: Emit): void {
  // Drones you didn't activate go on overwatch automatically.
  for (const d of drones(s)) {
    if (!d.acted && !d.overwatch && droneCan(d, 'overwatch')) {
      d.overwatch = true;
      emit({ type: 'overwatchSet', unitId: d.id });
    }
  }
  emit({ type: 'enemyPhase' });
  runEnemyPhase(s, emit);
  tickTimers(s, emit);
  startRound(s, emit);
}

/** Counts down bulkheads, forced darkness and scans after the enemy phase. */
export function tickTimers(s: GameState, emit: Emit): void {
  for (const d of s.doors) {
    if (d.sealedRounds <= 0) continue;
    d.sealedRounds--;
    if (d.sealedRounds === 0) emit({ type: 'doorUnsealed', pos: { ...d.pos } });
  }
  for (const z of s.zones) if (z.darkRounds > 0) z.darkRounds--;
  s.scans = [];
}

export function startRound(s: GameState, emit: Emit): void {
  s.round++;
  emit({ type: 'roundStarted', round: s.round });

  const shortfall = refillPower(s);
  const browned = new Set(brownoutDrones(s, shortfall).map((d) => d.id));
  for (const d of drones(s)) {
    d.ap = browned.has(d.id) ? CONFIG.power.brownoutAp : CONFIG.turn.apPerTurn;
    d.acted = false;
    d.overwatch = false;
    d.aimBonus = 0;
    d.disableNext = false;
  }
  if (browned.size > 0) emit({ type: 'brownout', unitIds: [...browned] });
  emit({ type: 'powerChanged', power: s.power, reason: 'refill' });

  if (!CONFIG.turn.retainHand) {
    s.deck.discard.push(...s.deck.hand);
    s.deck.hand = [];
  }
  const drawn = drawUpTo(s, CONFIG.turn.handSize);
  if (drawn > 0) emit({ type: 'cardsDrawn', count: drawn });
}
