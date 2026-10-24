// Command validation. Returns an error message, or null if the command is legal.
// The UI uses the same checks to decide what to offer.

import { repairCost, withinReach } from './actions';
import { canTarget } from './combat';
import { CARDS } from './content/cards';
import { cardError } from './effects';
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
  if (s.pendingChoice && cmd.type !== 'chooseModule') return 'Choose a module from the captured tech first.';
  switch (cmd.type) {
    case 'chooseModule': {
      if (!s.pendingChoice) return 'There is nothing to choose.';
      if (cmd.index < 0 || cmd.index >= s.pendingChoice.options.length) return 'No such option.';
      return null;
    }
    case 'pickUp': {
      const u = readyDrone(s, cmd.unitId);
      if (typeof u === 'string') return u;
      if (!droneCan(u, 'haul')) return `${u.name} can't haul. Only Workers can.`;
      if (u.carrying !== null) return `${u.name} is already hauling a husk.`;
      const husk = s.husks.find((h) => h.id === cmd.huskId);
      if (!husk || husk.carriedBy !== null) return 'No husk there.';
      if (!withinReach(u.pos, husk.pos)) return `${u.name} must stand on or next to the husk.`;
      return null;
    }
    case 'drop': {
      const u = unitById(s, cmd.unitId);
      if (!u || u.carrying === null) return 'Nothing to drop.';
      return null;
    }
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
    case 'salvage': {
      const u = readyDrone(s, cmd.unitId);
      if (typeof u === 'string') return u;
      if (!droneCan(u, 'salvage')) return `${u.name} can't salvage.`;
      const spot = s.salvage.find((x) => x.id === cmd.spotId);
      if (!spot || spot.charges <= 0) return 'Nothing left to salvage there.';
      if (!withinReach(u.pos, spot.pos)) return `${u.name} must stand on or next to the salvage.`;
      return null;
    }
    case 'repair': {
      const u = readyDrone(s, cmd.unitId);
      if (typeof u === 'string') return u;
      if (!droneCan(u, 'repair')) return `${u.name} can't repair.`;
      const sys = s.systems.find((x) => x.id === cmd.systemId);
      if (!sys || (sys.kind !== 'generator' && sys.kind !== 'relay')) return 'Nothing to repair there.';
      if (sys.working) return `${sys.name} is already working.`;
      if (!withinReach(u.pos, sys.pos)) return `${u.name} must be next to the ${sys.name}.`;
      if (s.matter < repairCost(sys.kind)) return `Repair needs ${repairCost(sys.kind)} matter.`;
      return null;
    }
    case 'playCard': {
      const inst = s.deck.hand.find((c) => c.uid === cmd.uid);
      if (!inst) return 'That card is not in your hand.';
      return cardError(s, CARDS[inst.cardId], cmd.target);
    }
    case 'discard': {
      if (!s.deck.hand.some((c) => c.uid === cmd.uid)) return 'That card is not in your hand.';
      if (s.discardsLeft <= 0) return 'No discards left this turn.';
      return null;
    }
    case 'endTurn':
      return null;
    default:
      return `Unknown command.`;
  }
}
