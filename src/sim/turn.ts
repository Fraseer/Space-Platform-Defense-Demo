// End of the player's turn → enemy phase → start of the next round.

import { CONFIG } from './config';
import { runEnemyPhase } from './ai';
import type { Emit } from './actions';
import { brownoutDrones, drawUpTo, refillPower } from './economy';
import { drones, invaders } from './units';
import { idx } from './grid';
import { runDirector } from './director';
import type { InvaderType } from './types';
import { droneCan } from './validate';
import type { GameState } from './types';

export function endTurn(s: GameState, emit: Emit): void {
  // Drones you didn't activate go on overwatch automatically.
  const auto = drones(s).filter((d) => !d.acted && !d.overwatch && droneCan(d, 'overwatch'));
  for (const d of auto) {
    d.overwatch = true;
    emit({ type: 'overwatchSet', unitId: d.id, auto: true });
  }
  if (auto.length > 0) emit({ type: 'log', text: `Auto-overwatch: ${auto.map((d) => d.name).join(', ')}.`, tone: 'info' });
  emit({ type: 'enemyPhase' });
  runEnemyPhase(s, emit);
  bridgeOverride(s, emit);
  if (s.status !== 'playing') return;
  tickTimers(s, emit);
  runDirector(s, emit, () => {});
  startRound(s, emit);
}

/** Invaders standing on the bridge wear down its integrity. 0 = the AI is overridden. */
export function bridgeOverride(s: GameState, emit: Emit): void {
  const bridge = new Set(s.bridgeTiles);
  const amount = invaders(s)
    .filter((u) => bridge.has(idx(s, u.pos)))
    .reduce((sum, u) => sum + CONFIG.invaders[u.type as InvaderType].override, 0);
  if (amount <= 0) return;
  s.bridge.integrity = Math.max(0, s.bridge.integrity - amount);
  emit({ type: 'bridgeDamaged', amount, integrity: s.bridge.integrity });
  if (s.bridge.integrity === 0) endGame(s, 'lost', 'Invaders overrode the bridge. The AI has been shut down.', emit);
}

export function endGame(s: GameState, status: 'won' | 'lost', outcome: string, emit: Emit): void {
  if (s.status !== 'playing') return;
  s.status = status;
  s.outcome = outcome;
  emit({ type: 'gameOver', status, outcome });
}

/** Milestone 4 victory: every breach has arrived and no invader is left alive. */
export function checkVictory(s: GameState, emit: Emit): void {
  if (s.status !== 'playing') return;
  if (s.breaches.length > 0 && s.breaches.every((b) => b.arrived) && invaders(s).length === 0) {
    endGame(s, 'won', 'Every breach repelled. The command deck is secure.', emit);
  }
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
