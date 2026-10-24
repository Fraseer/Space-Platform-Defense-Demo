// Human-readable log lines for events. Returns null for events that don't need a line.

import type { GameEvent, GameState } from './types';

export interface LogLine {
  text: string;
  tone: 'info' | 'warn' | 'good' | 'bad';
}

function nameOf(s: GameState, id: number | null): string {
  if (id === null) return 'something';
  return s.units.find((u) => u.id === id)?.name ?? `unit #${id}`;
}

export function describeEvent(e: GameEvent, s: GameState): LogLine | null {
  switch (e.type) {
    case 'log':
      return { text: e.text, tone: e.tone ?? 'info' };
    case 'roundStarted':
      return { text: `— Round ${e.round} —`, tone: 'info' };
    case 'enemyPhase':
      return { text: 'Enemy turn.', tone: 'warn' };
    case 'brownout':
      return { text: `Brownout: upkeep exceeds income. ${e.unitIds.map((id) => nameOf(s, id)).join(', ')} start with reduced AP.`, tone: 'bad' };
    default:
      return null;
  }
}
