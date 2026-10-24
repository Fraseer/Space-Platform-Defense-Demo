// Command validation. Returns an error message, or null if the command is legal.
// The UI uses the same checks to decide what to offer.

import { canTarget } from './combat';
import { DRONES, type DroneAbility } from './content/units';
import { planMove } from './pathfinding';
import { unitById } from './units';
import type { Command, DroneType, GameState, Unit } from './types';

export function droneCan(u: Unit, ability: DroneAbility): boolean {
  if (u.side !== 'drone') return false;
  if (DRONES[u.type as DroneType].abilities.includes(ability)) return true;
  return (ability === 'repair' || ability === 'salvage') && u.modules.includes('remoteUplink');
}

function readyDrone(s: GameState, unitId: number): Unit | string {
  const u = unitById(s, unitId);
  if (!u || u.side !== 'drone') return 'No such drone.';
  if (u.ap <= 0) return `${u.name} has no AP left.`;
  return u;
}

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
    case 'shoot': {
      const u = readyDrone(s, cmd.unitId);
      if (typeof u === 'string') return u;
      if (!droneCan(u, 'shoot')) return `${u.name} has no weapon.`;
      const target = unitById(s, cmd.targetId);
      if (!target || target.side !== 'invader') return 'No such target.';
      if (!canTarget(s, u, target)) return `${u.name} has no shot on that target.`;
      return null;
    }
    case 'overwatch': {
      const u = readyDrone(s, cmd.unitId);
      if (typeof u === 'string') return u;
      if (!droneCan(u, 'overwatch')) return `${u.name} can't overwatch.`;
      return null;
    }
    case 'endTurn':
      return null;
    default:
      return `Unknown command.`;
  }
}
