// Command validation. Returns an error message, or null if the command is legal.
// The UI uses the same checks to decide what to offer.

import { planMove } from './pathfinding';
import { unitById } from './units';
import type { Command, GameState } from './types';

export function validateCommand(s: GameState, cmd: Command): string | null {
  if (s.status !== 'playing') return 'The game is over.';
  switch (cmd.type) {
    case 'move': {
      const u = unitById(s, cmd.unitId);
      if (!u || u.side !== 'drone') return 'No such drone.';
      if (u.ap <= 0) return `${u.name} has no AP left.`;
      if (!planMove(s, u, cmd.to)) return `${u.name} can't reach that tile.`;
      return null;
    }
    case 'endTurn':
      return null;
    default:
      return `Unknown command.`;
  }
}
