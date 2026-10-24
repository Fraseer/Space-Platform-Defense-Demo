// Human-readable log lines for events. Returns null for events that don't need a line.

import { CARDS } from './content/cards';
import { airlockName } from './director';
import { MODULES } from './content/modules';
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
    case 'shot': {
      const who = e.shooterSeen ? nameOf(s, e.shooterId) : 'Unseen contact';
      const prefix = e.info.overwatch ? '[Overwatch] ' : '';
      const outcome = e.info.hit ? `hit for ${e.info.damage}` : `grazed for ${e.info.damage}`;
      const flank = e.info.flanked ? ', flanked' : '';
      const tone = s.units.find((u) => u.id === e.shooterId)?.side === 'invader' ? 'bad' : 'info';
      return { text: `${prefix}${who} → ${nameOf(s, e.targetId)}: ${outcome} (${e.info.chance}%${flank}).`, tone };
    }
    case 'killed': {
      const victim = s.units.find((u) => u.id === e.unitId);
      const verb = e.cause === 'vent' ? 'vented into space' : e.cause === 'drill' ? 'crushed by the drill' : e.cause === 'recycle' ? 'recycled' : 'destroyed';
      const by = e.cause === 'shot' && e.byId !== null ? ` by ${nameOf(s, e.byId)}` : '';
      return { text: `${victim?.name ?? 'Unit'} ${verb}${by}.`, tone: victim?.side === 'drone' ? 'bad' : 'good' };
    }
    case 'overwatchSet':
      return e.auto ? null : { text: `${nameOf(s, e.unitId)} on overwatch.`, tone: 'info' };
    case 'matterChanged':
      return e.delta === 0 ? null : { text: `${e.delta > 0 ? '+' : ''}${e.delta} matter (${e.reason}).`, tone: e.delta > 0 ? 'good' : 'info' };
    case 'cardPlayed':
      return { text: `Played ${CARDS[e.cardId]?.name ?? e.cardId}.`, tone: 'info' };
    case 'unitSpawned':
      return e.unit.side === 'drone' ? { text: `${e.unit.name} fabricated.`, tone: 'good' } : null;
    case 'apGained':
      return { text: `${nameOf(s, e.unitId)} +${e.amount} AP.`, tone: 'info' };
    case 'healed':
      return { text: `${nameOf(s, e.unitId)} repaired for ${e.amount}.`, tone: 'good' };
    case 'salvaged':
      return { text: `${nameOf(s, e.unitId)} salvaged ${e.amount} matter.`, tone: 'good' };
    case 'systemRepaired': {
      const sys = s.systems.find((x) => x.id === e.systemId);
      return { text: `${sys?.name ?? 'System'} repaired.`, tone: 'good' };
    }
    case 'doorSealed':
      return { text: `Bulkhead sealed for ${e.rounds} rounds.`, tone: 'info' };
    case 'doorUnsealed':
      return { text: 'A bulkhead reopened.', tone: 'info' };
    case 'zoneVented':
      return { text: `${s.zones[e.zone]?.name ?? 'Section'} vented into space.`, tone: 'warn' };
    case 'zoneDarkened':
      return { text: `${s.zones[e.zone]?.name ?? 'Section'} goes dark for ${e.rounds} rounds.`, tone: 'info' };
    case 'scanned':
      return { text: `Scan pulse: contacts within ${e.radius} tiles revealed.`, tone: 'info' };
    case 'moduleInstalled':
      return { text: `${nameOf(s, e.unitId)} installed ${MODULES[e.moduleId]?.name ?? e.moduleId}.`, tone: 'good' };
    case 'breachWarning': {
      const when = e.inRounds <= 1 ? 'next turn' : `in ${e.inRounds} turns`;
      return e.boss
        ? { text: `WARNING: boarding vessel docking at ${airlockName(s, e.airlock)} ${when}. Bring your drones home.`, tone: 'bad' }
        : { text: `Breach detected: ${airlockName(s, e.airlock)} ${when}.`, tone: 'warn' };
    }
    case 'breach':
      return { text: e.boss ? `The boarding vessel has docked at ${airlockName(s, e.airlock)}!` : `BREACH at ${airlockName(s, e.airlock)}!`, tone: 'bad' };
    case 'bridgeDamaged':
      return { text: `Bridge override in progress: −${e.amount} integrity (${e.integrity} left).`, tone: 'bad' };
    case 'systemSabotaged': {
      const sys = s.systems.find((x) => x.id === e.systemId);
      return { text: `${sys?.name ?? 'A system'} sabotaged${e.seen ? ` by ${nameOf(s, e.byId)}` : ''}!`, tone: 'bad' };
    }
    case 'gameOver':
      return { text: e.status === 'won' ? `VICTORY. ${e.outcome}` : `DEFEAT. ${e.outcome}`, tone: e.status === 'won' ? 'good' : 'bad' };
    case 'brownout':
      return { text: `Brownout: upkeep exceeds income. ${e.unitIds.map((id) => nameOf(s, id)).join(', ')} start with reduced AP.`, tone: 'bad' };
    default:
      return null;
  }
}
