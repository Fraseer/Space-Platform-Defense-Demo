// Captured invader tech. Each invader type has a pool of three modules; hauling
// a husk to the fabricator lets you pick one as a card.

import { CONFIG } from '../config';
import type { InvaderType } from '../types';

export interface ModuleDef {
  id: string;
  name: string;
  from: InvaderType;
  text: string;
  stats?: Partial<Record<'move' | 'upkeep' | 'hp' | 'damageReduction' | 'damage' | 'sensor', number>>;
}

const M = CONFIG.modules;

export const MODULES: Record<string, ModuleDef> = {
  servoLegs: { id: 'servoLegs', name: 'Servo Legs', from: 'runner', text: `+${M.servoLegs.move} move per AP.`, stats: { move: M.servoLegs.move } },
  reflexLoop: { id: 'reflexLoop', name: 'Reflex Loop', from: 'runner', text: 'Overwatch shots have no aim penalty.' },
  featherweight: {
    id: 'featherweight',
    name: 'Featherweight Frame',
    from: 'runner',
    text: `Upkeep ${M.featherweight.upkeep}, max HP ${M.featherweight.hp}.`,
    stats: { upkeep: M.featherweight.upkeep, hp: M.featherweight.hp },
  },
  ablativePlating: { id: 'ablativePlating', name: 'Ablative Plating', from: 'brute', text: `+${M.ablativePlating.hp} max HP.`, stats: { hp: M.ablativePlating.hp } },
  hardenedShell: {
    id: 'hardenedShell',
    name: 'Hardened Shell',
    from: 'brute',
    text: `Takes ${M.hardenedShell.damageReduction} less damage from every hit (min 1).`,
    stats: { damageReduction: M.hardenedShell.damageReduction },
  },
  siegeCannon: {
    id: 'siegeCannon',
    name: 'Siege Cannon',
    from: 'brute',
    text: `+${M.siegeCannon.damage} damage, ${M.siegeCannon.move} move.`,
    stats: { damage: M.siegeCannon.damage, move: M.siegeCannon.move },
  },
  signalJammer: {
    id: 'signalJammer',
    name: 'Signal Jammer',
    from: 'saboteur',
    text: `Invaders within ${M.signalJammer.radius} tiles get -${M.signalJammer.aimPenalty} aim.`,
  },
  opticSpike: { id: 'opticSpike', name: 'Optic Spike', from: 'saboteur', text: `+${M.opticSpike.sensor} sensor radius.`, stats: { sensor: M.opticSpike.sensor } },
  remoteUplink: { id: 'remoteUplink', name: 'Remote Uplink', from: 'saboteur', text: 'This drone can Repair and Salvage like a Worker.' },
  plasmaCutter: { id: 'plasmaCutter', name: 'Plasma Cutter', from: 'breacher', text: 'Cut through an adjacent wall (2 AP).' },
};

export const MODULE_POOLS: Record<InvaderType, string[]> = {
  runner: ['servoLegs', 'reflexLoop', 'featherweight'],
  brute: ['ablativePlating', 'hardenedShell', 'siegeCannon'],
  saboteur: ['signalJammer', 'opticSpike', 'remoteUplink'],
  breacher: ['plasmaCutter'],
  rig: [],
};
