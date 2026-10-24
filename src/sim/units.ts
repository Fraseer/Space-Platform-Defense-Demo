// Unit creation and derived stats (base numbers from config + installed modules).

import { CONFIG } from './config';
import { DRONES, INVADERS } from './content/units';
import { MODULES } from './content/modules';
import { rngInt } from './rng';
import type { DroneType, GameState, InvaderType, Unit, Vec } from './types';

export interface UnitStats {
  maxHp: number;
  move: number;
  aim: number;
  damage: number;
  optimalRange: number;
  maxRange: number;
  sensor: number;
  upkeep: number;
  damageReduction: number;
}

export function isDrone(u: Unit): boolean {
  return u.side === 'drone';
}

export function isInvader(u: Unit): boolean {
  return u.side === 'invader';
}

export function baseStats(u: Unit): UnitStats {
  if (u.side === 'drone') {
    const c = CONFIG.drones[u.type as DroneType];
    return { maxHp: c.hp, move: c.move, aim: c.aim, damage: c.damage, optimalRange: c.optimalRange, maxRange: c.maxRange, sensor: c.sensor, upkeep: c.upkeep, damageReduction: 0 };
  }
  const c = CONFIG.invaders[u.type as InvaderType];
  return { maxHp: c.hp, move: c.move, aim: c.aim, damage: c.damage, optimalRange: c.optimalRange, maxRange: c.maxRange, sensor: 0, upkeep: 0, damageReduction: 0 };
}

export function stats(u: Unit): UnitStats {
  const st = baseStats(u);
  for (const m of u.modules) {
    const mod = MODULES[m]?.stats;
    if (!mod) continue;
    st.maxHp += mod.hp ?? 0;
    st.move += mod.move ?? 0;
    st.damage += mod.damage ?? 0;
    st.sensor += mod.sensor ?? 0;
    st.upkeep = Math.max(0, st.upkeep + (mod.upkeep ?? 0));
    st.damageReduction += mod.damageReduction ?? 0;
  }
  if (u.carrying !== null) st.move = Math.max(1, st.move - CONFIG.worker.haulMovePenalty);
  return st;
}

export function hasModule(u: Unit, moduleId: string): boolean {
  return u.modules.includes(moduleId);
}

function baseUnit(s: GameState, side: Unit['side'], type: Unit['type'], name: string, pos: Vec, hp: number): Unit {
  return {
    id: s.nextId++,
    side,
    type,
    name,
    pos: { ...pos },
    hp,
    maxHp: hp,
    ap: 0,
    acted: false,
    overwatch: false,
    kills: 0,
    aimBonus: 0,
    disableNext: false,
    modules: [],
    carrying: null,
    serial: s.nextId,
  };
}

export function createDrone(s: GameState, type: DroneType, pos: Vec): Unit {
  const def = DRONES[type];
  const serial = String(1000 + rngInt(s, 9000));
  const u = baseUnit(s, 'drone', type, `${def.prefix}-${serial}`, pos, CONFIG.drones[type].hp);
  return u;
}

export function createInvader(s: GameState, type: InvaderType, pos: Vec): Unit {
  return baseUnit(s, 'invader', type, INVADERS[type].name, pos, CONFIG.invaders[type].hp);
}

export function drones(s: GameState): Unit[] {
  return s.units.filter(isDrone);
}

export function invaders(s: GameState): Unit[] {
  return s.units.filter(isInvader);
}

export function unitById(s: GameState, id: number): Unit | undefined {
  return s.units.find((u) => u.id === id);
}
