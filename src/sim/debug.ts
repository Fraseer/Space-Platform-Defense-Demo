// Playtesting shortcuts. Pure functions over GameState, used by the Debug panel.

import { applyCommand } from './reducer';
import type { GameState } from './types';

/**
 * Ends turns until the boss docks, removing regular invaders before each
 * enemy phase so the run arrives intact. For testing the boss fight.
 */
export function skipToBoss(state: GameState): GameState {
  let s = state;
  const boss = s.breaches.find((b) => b.boss);
  if (!boss) return s;
  while (s.status === 'playing' && !boss.arrived && s.round < boss.arriveRound) {
    s = { ...s, units: s.units.filter((u) => u.side === 'drone'), pendingChoice: null };
    const r = applyCommand(s, { type: 'endTurn' });
    if (!r.ok) break;
    s = r.state;
    if (s.breaches.find((b) => b.boss)?.arrived) break;
  }
  return s;
}
