// Enemy AI. Each invader scores every tile it can reach this turn on:
//   progress toward its goal, cover from drones that could shoot it,
//   the best shot it would have from there, flanking that shot,
//   and how many drones would flank it there (exposure);
// then moves to the best tile and acts. No dice in the decision, so the
// intent overlay shows exactly what an invader will do if nothing changes.

import { CONFIG } from './config';
import { moveAlong, withinReach, type Emit } from './actions';
import { canTarget, coverAgainst, previewShot, resolveShot } from './combat';
import { INVADERS } from './content/units';
import { distance, hasLineOfSight, idx, posOf } from './grid';
import { apForSteps, goalField, moveField, pathFromField } from './pathfinding';
import { clone } from './util';
import { drones, invaders, stats, unitById } from './units';
import { invaderCanSee, shipCanSee } from './vision';
import type { GameState, InvaderType, SystemObj, Unit, Vec } from './types';

export type IntentAction = { kind: 'shoot'; targetId: number } | { kind: 'sabotage'; systemId: number };

export interface Intent {
  unitId: number;
  from: Vec;
  path: Vec[];
  action: IntentAction | null;
}

export interface TileScore {
  pos: Vec;
  score: number;
  parts: Record<string, number>;
}

interface Decision {
  path: Vec[];
  ap: number;
  action: IntentAction | null;
  score: number;
}

type Goal = { kind: 'bridge' | 'hunt' | 'sabotage'; tiles: number[]; systems: SystemObj[] };

/** Systems a Saboteur wants to break: ones the player repaired that are working. */
export function sabotageTargets(s: GameState): SystemObj[] {
  return s.systems.filter((x) => x.repaired && x.working && (x.kind === 'relay' || x.kind === 'generator'));
}

function goalFor(s: GameState, u: Unit): Goal {
  const bridge: Goal = { kind: 'bridge', tiles: s.bridgeTiles, systems: [] };
  const goal = INVADERS[u.type as InvaderType].goal;
  if (goal === 'hunt') {
    const seen = knownDrones(s, u);
    if (seen.length > 0) return { kind: 'hunt', tiles: seen.map((d) => idx(s, d.pos)), systems: [] };
  }
  if (goal === 'sabotage') {
    const systems = sabotageTargets(s);
    if (systems.length > 0) {
      const tiles: number[] = [];
      for (const sys of systems)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const p = { x: sys.pos.x + dx, y: sys.pos.y + dy };
            if ((dx || dy) && s.tiles[idx(s, p)] !== 'wall' && s.tiles[idx(s, p)] !== 'system') tiles.push(idx(s, p));
          }
      return { kind: 'sabotage', tiles, systems };
    }
  }
  return bridge;
}

function weightsFor(u: Unit) {
  return CONFIG.ai.weights[u.type] ?? CONFIG.ai.weights.brute;
}

/**
 * Drones this invader knows about: the ones it can see from where it starts
 * its turn. In the dark that is only a few tiles, so invaders blunder about.
 */
function knownDrones(s: GameState, u: Unit): Unit[] {
  return drones(s).filter((d) => invaderCanSee(s, u.pos, d.pos));
}

/** Score one candidate tile. `apAfter` is the AP the invader would have left there. */
function scoreTile(
  s: GameState,
  u: Unit,
  pos: Vec,
  apAfter: number,
  goal: Goal,
  field: number[],
  known: Unit[],
): { score: number; parts: Record<string, number>; action: IntentAction | null } {
  const w = weightsFor(u);
  const st = stats(u);
  const parts: Record<string, number> = {};
  const here = field[idx(s, u.pos)];
  const there = field[idx(s, pos)];
  const progress = Number.isFinite(here) && Number.isFinite(there) ? (here - there) / Math.max(1, st.move) : 0;
  parts.progress = w.progress * progress;

  // Drones that could shoot this tile: how well covered is it, how many flank it?
  let threats = 0;
  let minCover = 2;
  let exposure = 0;
  for (const d of known) {
    if (distance(d.pos, pos) > stats(d).maxRange || !hasLineOfSight(s, d.pos, pos)) continue;
    threats++;
    const c = coverAgainst(s, pos, d.pos);
    minCover = Math.min(minCover, c);
    if (c === 0) exposure++;
  }
  parts.cover = w.cover * (threats > 0 ? minCover / 2 : 0.5);
  parts.exposure = -w.exposure * exposure;

  let action: IntentAction | null = null;
  if (apAfter >= 1) {
    const sys = goal.kind === 'sabotage' ? goal.systems.find((x) => withinReach(pos, x.pos)) : undefined;
    if (sys) {
      action = { kind: 'sabotage', systemId: sys.id };
      parts.sabotage = CONFIG.ai.sabotageBonus;
    } else {
      let best = 0;
      let flanked = false;
      for (const d of known) {
        if (!canTarget(s, u, d, pos)) continue;
        const p = previewShot(s, u, d, { from: pos });
        const hit = p.chance / 100;
        const expected = hit * p.damage + (1 - hit) * p.grazeDamage;
        const value = expected / 4 + (p.grazeDamage >= d.hp ? 1 : 0);
        if (value > best) {
          best = value;
          flanked = p.flanked;
          action = { kind: 'shoot', targetId: d.id };
        }
      }
      parts.shot = w.shot * best;
      parts.flank = flanked ? w.flank : 0;
    }
  }
  if (goal.kind === 'bridge' && s.bridgeTiles.includes(idx(s, pos))) parts.bridge = CONFIG.ai.bridgeBonus;

  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  return { score, parts, action };
}

function candidates(s: GameState, u: Unit): { pos: Vec; path: Vec[]; ap: number }[] {
  const move = stats(u).move;
  const out: { pos: Vec; path: Vec[]; ap: number }[] = [{ pos: { ...u.pos }, path: [], ap: 0 }];
  if (move <= 0) return out;
  const field = moveField(s, u, move * Math.min(2, u.ap));
  const occupied = new Set(s.units.map((x) => idx(s, x.pos)));
  for (let i = 0; i < field.dist.length; i++) {
    const steps = field.dist[i];
    if (steps <= 0 || occupied.has(i)) continue;
    out.push({ pos: posOf(s, i), path: pathFromField(s, field, posOf(s, i))!, ap: apForSteps(steps, move) });
  }
  return out;
}

export function decide(s: GameState, u: Unit): Decision {
  const goal = goalFor(s, u);
  const field = goalField(s, goal.tiles);
  const known = knownDrones(s, u);
  let best: Decision | null = null;
  for (const c of candidates(s, u)) {
    const { score, action } = scoreTile(s, u, c.pos, u.ap - c.ap, goal, field, known);
    if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && c.ap < best.ap)) {
      best = { path: c.path, ap: c.ap, action, score };
    }
  }
  return best!;
}

/** Every reachable tile's score for one invader (debug overlay). */
export function scoreTilesFor(s: GameState, unitId: number): TileScore[] {
  const u = unitById(s, unitId);
  if (!u || u.side !== 'invader' || !isMobileInvader(u)) return [];
  const sim = clone(s);
  const me = unitById(sim, unitId)!;
  me.ap = CONFIG.turn.apPerTurn;
  const goal = goalFor(sim, me);
  const field = goalField(sim, goal.tiles);
  const known = knownDrones(sim, me);
  return candidates(sim, me).map((c) => {
    const r = scoreTile(sim, me, c.pos, me.ap - c.ap, goal, field, known);
    return { pos: c.pos, score: r.score, parts: r.parts };
  });
}

function isMobileInvader(u: Unit): boolean {
  return u.type !== 'rig' && u.type !== 'breacher';
}

function sabotage(s: GameState, u: Unit, sys: SystemObj, emit: Emit): void {
  sys.working = false;
  sys.repaired = false;
  emit({ type: 'systemSabotaged', systemId: sys.id, byId: u.id, seen: shipCanSee(s, u.pos) });
}

function bestShot(s: GameState, u: Unit): Unit | null {
  let best: Unit | null = null;
  let bestValue = -1;
  for (const d of drones(s)) {
    if (!canTarget(s, u, d)) continue;
    const p = previewShot(s, u, d);
    const value = p.chance * p.damage;
    if (value > bestValue) {
      bestValue = value;
      best = d;
    }
  }
  return best;
}

/** One invader's turn: move to its best tile, then shoot or sabotage. */
function actInvader(s: GameState, u: Unit, emit: Emit): void {
  u.ap = CONFIG.turn.apPerTurn;
  const plan = decide(s, u);
  if (plan.path.length > 0) {
    u.ap -= plan.ap;
    if (!moveAlong(s, u, plan.path, emit)) return;
  }
  if (u.ap < 1) return;
  const action = plan.action;
  if (action?.kind === 'sabotage') {
    const sys = s.systems.find((x) => x.id === action.systemId);
    if (sys && sys.working && withinReach(u.pos, sys.pos)) {
      u.ap = 0;
      sabotage(s, u, sys, emit);
      return;
    }
  }
  const planned = plan.action?.kind === 'shoot' ? unitById(s, plan.action.targetId) : undefined;
  const target = planned && canTarget(s, u, planned) ? planned : bestShot(s, u);
  if (target) {
    u.ap = 0;
    resolveShot(s, u, target, {}, emit);
  }
}

export function runEnemyPhase(s: GameState, emit: Emit): void {
  for (const id of invaders(s).map((u) => u.id)) {
    const u = unitById(s, id);
    if (!u || !isMobileInvader(u)) continue;
    actInvader(s, u, emit);
    if (s.status !== 'playing') return;
  }
}

/** What every mobile invader would do if the turn ended now (no overwatch, no dice). */
export function planIntents(s: GameState): Intent[] {
  const sim = clone(s);
  const out: Intent[] = [];
  for (const id of invaders(sim).map((u) => u.id)) {
    const u = unitById(sim, id)!;
    if (!isMobileInvader(u)) continue;
    u.ap = CONFIG.turn.apPerTurn;
    const plan = decide(sim, u);
    out.push({ unitId: id, from: { ...u.pos }, path: plan.path, action: plan.action });
    if (plan.path.length > 0) u.pos = { ...plan.path[plan.path.length - 1] };
  }
  return out;
}
