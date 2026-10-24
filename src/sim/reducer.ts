// The single entry point to the rules: validate a command, apply it to a copy
// of the state, and return the new state plus the events that happened.

import { doMove } from './actions';
import { endTurn } from './turn';
import { clone } from './util';
import { validateCommand } from './validate';
import type { Command, CommandResult, GameEvent, GameState } from './types';

export function applyCommand(state: GameState, cmd: Command): CommandResult {
  const error = validateCommand(state, cmd);
  if (error) return { ok: false, error, state, events: [] };
  const s = clone(state);
  const events: GameEvent[] = [];
  const emit = (e: GameEvent) => events.push(e);
  switch (cmd.type) {
    case 'move':
      doMove(s, cmd, emit);
      break;
    case 'endTurn':
      endTurn(s, emit);
      break;
  }
  return { ok: true, state: s, events };
}
