// Shooting: hit chance (shown to the player as a breakdown), directional cover,
// flanking, grazes (a miss still deals partial damage), damage and kills.

import { CONFIG } from './config';
import { DIRS4, coverOf, distance, hasLineOfSight } from './grid';
import { gainMatter } from './economy';
import { rngRoll } from './rng';
import { hasModule, stats, unitById } from './units';
import { invaderAimPenaltyFromDark, shipCanSee } from './vision';
import type { Emit } from './actions';
import type { GameState, InvaderType, ShotInfo, Unit, Vec } from './types';

export interface ShotModifier {
  label: string;
  value: number;
}

export interface ShotPreview {
  chance: number;
  modifiers: ShotModifier[];
  damage: number;
  grazeDamage: number;
  cover: 0 | 1 | 2;
  flanked: boolean;
  distance: number;
}

/**
 * Best cover the target has against an attacker: walls, full/half cover and
 * sealed doors on the target's sides that face the attacker.
 */
export function coverAgainst(s: GameState, target: Vec, attacker: Vec): 0 | 1 | 2 {
  const vx = attacker.x - target.x;
  const vy = attacker.y - target.y;
  const len = Math.hypot(vx, vy);
  if (len === 0) return 0;
  let best: 0 | 1 | 2 = 0;
  for (const d of DIRS4) {
    const dot = (vx * d.x + vy * d.y) / len;
    if (dot < CONFIG.combat.coverMinDot) continue;
    const c = coverOf(s, { x: target.x + d.x, y: target.y + d.y });
    if (c > best) best = c;
  }
  return best;
}

/** Can `shooter` shoot `target` from `from` (defaults to where the shooter stands)? */
export function canTarget(s: GameState, shooter: Unit, target: Unit, from: Vec = shooter.pos): boolean {
  if (shooter.side === target.side) return false;
  const st = stats(shooter);
  if (st.maxRange <= 0) return false;
  if (distance(from, target.pos) > st.maxRange) return false;
  if (!hasLineOfSight(s, from, target.pos)) return false;
  if (shooter.side === 'drone') return shipCanSee(s, target.pos);
  return true;
}

/** Hit chance and damage for a shot, with every modifier listed. */
export function previewShot(s: GameState, shooter: Unit, target: Unit, opts: { overwatch?: boolean; from?: Vec } = {}): ShotPreview {
  const from = opts.from ?? shooter.pos;
  const st = stats(shooter);
  const C = CONFIG.combat;
  const modifiers: ShotModifier[] = [{ label: 'Aim', value: st.aim }];
  const dist = distance(from, target.pos);
  const beyond = Math.max(0, Math.ceil(dist - st.optimalRange));
  if (beyond > 0) modifiers.push({ label: `Range (${beyond} past optimal)`, value: -beyond * C.rangeFalloffPerTile });
  const cover = coverAgainst(s, target.pos, from);
  if (cover === 1) modifiers.push({ label: 'Half cover', value: -C.halfCover });
  if (cover === 2) modifiers.push({ label: 'Full cover', value: -C.fullCover });
  if (shooter.aimBonus > 0) modifiers.push({ label: 'Targeting Uplink', value: shooter.aimBonus });
  if (opts.overwatch && !hasModule(shooter, 'reflexLoop')) modifiers.push({ label: 'Overwatch', value: -C.overwatchPenalty });
  if (shooter.side === 'invader') {
    const dark = invaderAimPenaltyFromDark(s, from, target.pos);
    if (dark > 0) modifiers.push({ label: 'Darkness', value: -dark });
    const jammer = s.units.find(
      (u) => u.side === 'drone' && hasModule(u, 'signalJammer') && distance(u.pos, from) <= CONFIG.modules.signalJammer.radius!,
    );
    if (jammer) modifiers.push({ label: 'Signal Jammer', value: -CONFIG.modules.signalJammer.aimPenalty! });
  }
  const raw = modifiers.reduce((sum, m) => sum + m.value, 0);
  const chance = Math.max(C.minHit, Math.min(C.maxHit, raw));
  const flanked = cover === 0;
  const damage = st.damage + (flanked ? C.flankDamageBonus : 0);
  const grazeDamage = Math.ceil(damage * C.grazeRatio);
  return { chance, modifiers, damage, grazeDamage, cover, flanked, distance: dist };
}

/** Rolls and resolves a shot. Returns true if the target died (or was disabled). */
export function resolveShot(s: GameState, shooter: Unit, target: Unit, opts: { overwatch?: boolean }, emit: Emit): boolean {
  const p = previewShot(s, shooter, target, opts);
  const hit = rngRoll(s, p.chance);
  const raw = hit ? p.damage : p.grazeDamage;
  const info: ShotInfo = { chance: p.chance, hit, damage: raw, flanked: p.flanked, overwatch: !!opts.overwatch };
  emit({
    type: 'shot',
    shooterId: shooter.id,
    targetId: target.id,
    from: { ...shooter.pos },
    to: { ...target.pos },
    info,
    shooterSeen: shooter.side === 'drone' || shipCanSee(s, shooter.pos),
  });
  const disable = shooter.disableNext;
  shooter.aimBonus = 0;
  shooter.disableNext = false;
  return applyDamage(s, target, raw, shooter.id, emit, { disable });
}

/** Deals damage; handles death, kill counts and matter. Returns true if the unit is gone. */
export function applyDamage(
  s: GameState,
  target: Unit,
  amount: number,
  sourceId: number | null,
  emit: Emit,
  opts: { disable?: boolean; cause?: 'shot' | 'vent' | 'drill' } = {},
): boolean {
  const reduced = Math.max(1, amount - stats(target).damageReduction);
  target.hp = Math.max(0, target.hp - reduced);
  emit({ type: 'damaged', unitId: target.id, amount: reduced, hp: target.hp });
  if (target.hp > 0) return false;
  killUnit(s, target, sourceId, emit, opts);
  return true;
}

export function killUnit(
  s: GameState,
  target: Unit,
  sourceId: number | null,
  emit: Emit,
  opts: { disable?: boolean; cause?: 'shot' | 'vent' | 'drill' | 'recycle' } = {},
): void {
  s.units = s.units.filter((u) => u.id !== target.id);
  const source = sourceId !== null ? unitById(s, sourceId) : undefined;
  if (target.side === 'invader') {
    if (source && source.side === 'drone') source.kills++;
    s.stats.kills++;
    if (opts.disable && target.type !== 'rig') {
      const huskId = s.nextId++;
      s.husks.push({ id: huskId, type: target.type as InvaderType, pos: { ...target.pos }, carriedBy: null });
      emit({ type: 'disabled', unitId: target.id, huskId });
      return;
    }
    emit({ type: 'killed', unitId: target.id, byId: sourceId, cause: opts.cause ?? 'shot' });
    const drop = CONFIG.invaders[target.type as InvaderType].matterDrop;
    if (drop > 0) {
      gainMatter(s, drop);
      emit({ type: 'matterChanged', matter: s.matter, delta: drop, reason: `${target.name} salvaged` });
    }
  } else {
    if (opts.cause !== 'recycle') s.stats.dronesLost++;
    if (target.carrying !== null) {
      const husk = s.husks.find((h) => h.id === target.carrying);
      if (husk) {
        husk.carriedBy = null;
        husk.pos = { ...target.pos };
        emit({ type: 'huskDropped', huskId: husk.id, pos: { ...husk.pos } });
      }
    }
    emit({ type: 'killed', unitId: target.id, byId: sourceId, cause: opts.cause ?? 'shot' });
  }
}

/**
 * Overwatch: after an invader steps onto a tile, every drone on overwatch that
 * can now target it fires once. Returns true if the invader died.
 */
export function triggerOverwatch(s: GameState, mover: Unit, emit: Emit): boolean {
  for (const d of s.units.filter((u) => u.side === 'drone' && u.overwatch)) {
    if (!canTarget(s, d, mover)) continue;
    d.overwatch = false;
    if (resolveShot(s, d, mover, { overwatch: true }, emit)) return true;
  }
  return false;
}
