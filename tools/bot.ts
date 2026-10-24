// A simple greedy bot for balance checks. It holds the bridge, repairs the
// generator, salvages in quiet turns, fabricates Sentries and shoots anything
// it has a decent shot on. Not smart — a rough stand-in for a careful player.

import { withinReach } from '../src/sim/actions';
import { canTarget, previewShot, type ShotPreview } from '../src/sim/combat';
import { CARDS } from '../src/sim/content/cards';
import { cardError } from '../src/sim/effects';
import { distance } from '../src/sim/grid';
import { moveOptions } from '../src/sim/pathfinding';
import { applyCommand } from '../src/sim/reducer';
import type { CardTarget, Command, GameState, Unit, Vec } from '../src/sim/types';

const DEAD_CARDS = ['ventSection', 'killTheLights', 'scan', 'recycle', 'emergencyBulkhead', 'disableShot'];

function act(s: GameState, cmd: Command): GameState {
  const r = applyCommand(s, cmd);
  return r.ok ? r.state : s;
}

function play(s: GameState, cardId: string, target: CardTarget): GameState {
  const inst = s.deck.hand.find((c) => c.cardId === cardId);
  if (!inst || cardError(s, CARDS[cardId], target)) return s;
  return act(s, { type: 'playCard', uid: inst.uid, target });
}

function bestShot(s: GameState, d: Unit): { u: Unit; p: ShotPreview } | null {
  let best: { u: Unit; p: ShotPreview; v: number } | null = null;
  for (const u of s.units) {
    if (u.side !== 'invader' || !canTarget(s, d, u)) continue;
    const p = previewShot(s, d, u);
    const v = p.chance * (u.type === 'rig' || u.type === 'breacher' ? 2 : 1);
    if (!best || v > best.v) best = { u, p, v };
  }
  return best;
}

const unit = (s: GameState, id: number) => s.units.find((u) => u.id === id);

function stepToward(s: GameState, d: Unit, goal: Vec): GameState {
  const opts = moveOptions(s, d)
    .filter((o) => o.ap === 1)
    .sort((a, b) => distance(a.pos, goal) - distance(b.pos, goal));
  if (opts[0] && distance(opts[0].pos, goal) < distance(d.pos, goal)) return act(s, { type: 'move', unitId: d.id, to: opts[0].pos });
  return s;
}

function workerTurn(s: GameState, id: number): GameState | null {
  let d = unit(s, id)!;
  const broken = s.systems.filter((x) => !x.working && (x.kind === 'generator' || x.kind === 'relay'));
  const repairTarget = broken.find((x) => x.kind === 'generator') ?? broken[0];
  const threat = s.units.some((u) => u.side === 'invader' && distance(u.pos, d.pos) < 9);
  if (threat) return null;
  if (repairTarget && s.matter >= 6 + (s.stats.dronesBuilt < 2 ? 8 : 0)) {
    for (let k = 0; k < 2 && d && d.ap > 0; k++) {
      if (withinReach(d.pos, repairTarget.pos)) return act(s, { type: 'repair', unitId: d.id, systemId: repairTarget.id });
      s = stepToward(s, d, repairTarget.pos);
      d = unit(s, id)!;
    }
    return s;
  }
  const spot = s.salvage.filter((sp) => sp.charges > 0).sort((a, b) => distance(a.pos, d.pos) - distance(b.pos, d.pos))[0];
  if (!spot) return null;
  for (let k = 0; k < 2 && d && d.ap > 0; k++) {
    if (withinReach(d.pos, spot.pos)) s = act(s, { type: 'salvage', unitId: d.id, spotId: spot.id });
    else s = stepToward(s, d, spot.pos);
    d = unit(s, id)!;
  }
  return s;
}

export function botTurn(state: GameState): GameState {
  let s = state;
  const dead = s.deck.hand.find((c) => DEAD_CARDS.includes(c.cardId));
  if (dead) s = act(s, { type: 'discard', uid: dead.uid });
  s = play(s, 'reroutePower', { kind: 'none' });
  if (s.units.filter((u) => u.side === 'drone').length < 5) s = play(s, 'fabricateSentry', { kind: 'none' });
  if (!s.units.some((u) => u.type === 'worker')) s = play(s, 'fabricateWorker', { kind: 'none' });

  for (const id of s.units.filter((u) => u.side === 'drone').map((u) => u.id)) {
    let d = unit(s, id);
    if (!d) continue;
    if (d.hp <= d.maxHp - 4) s = play(s, 'fieldRepair', { kind: 'unit', unitId: d.id });
    d = unit(s, id)!;
    if (d.type === 'worker') {
      const next = workerTurn(s, id);
      if (next) {
        s = next;
        continue;
      }
    }
    let shot = bestShot(s, d);
    if (shot && shot.p.chance < 70) {
      s = play(s, 'targetingUplink', { kind: 'unit', unitId: d.id });
      d = unit(s, id)!;
      shot = bestShot(s, d);
    }
    if (shot && shot.p.chance >= 35) {
      s = act(s, { type: 'shoot', unitId: d.id, targetId: shot.u.id });
      continue;
    }
    const boss = s.units.find((u) => u.type === 'breacher');
    const goal = boss ? boss.pos : { x: 12, y: 12 };
    if (distance(d.pos, goal) <= 1.5) continue;
    s = stepToward(s, d, goal);
    d = unit(s, id);
    if (!d) continue;
    const after = bestShot(s, d);
    if (after && after.p.chance >= 35) s = act(s, { type: 'shoot', unitId: d.id, targetId: after.u.id });
    else if (d.ap > 0) s = act(s, { type: 'overwatch', unitId: d.id });
  }
  if (s.pendingChoice) s = act(s, { type: 'chooseModule', index: 0 });
  return act(s, { type: 'endTurn' });
}
