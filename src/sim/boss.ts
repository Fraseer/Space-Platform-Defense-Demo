// The act 1 boss: the Siege Breacher docks at an airlock and drills a new
// corridor straight at the bridge, a few tiles per enemy turn. Its Drill Rig
// stays anchored at the airlock. Win by killing (or disabling) the Breacher,
// or by destroying the Rig, which stops the drill.

import { CONFIG } from './config';
import { moveAlong, type Emit } from './actions';
import { applyDamage, canTarget, previewShot, resolveShot } from './combat';
import { spawnBreach, spawnTiles } from './director';
import { DIRS4, idx, inBounds, posOf, unitAt } from './grid';
import { createInvader, drones, unitById } from './units';
import type { Breach, GameState, Unit, Vec } from './types';

/**
 * The drill's route from `start` to the nearest bridge tile. It goes through
 * walls and rooms alike (drilling is no slower than walking) but never
 * through a system or the hull, and hugs the straight line to the bridge.
 */
export function planTunnel(s: GameState, start: Vec): Vec[] {
  const n = s.width * s.height;
  const bridge = new Set(s.bridgeTiles);
  const centre = s.bridgeTiles.map((i) => posOf(s, i)).reduce((a, p) => ({ x: a.x + p.x / s.bridgeTiles.length, y: a.y + p.y / s.bridgeTiles.length }), { x: 0, y: 0 });
  const lx = centre.x - start.x;
  const ly = centre.y - start.y;
  const len = Math.hypot(lx, ly) || 1;
  const offLine = (p: Vec) => Math.abs((p.x - start.x) * ly - (p.y - start.y) * lx) / len;
  const passable = (p: Vec) => {
    if (!inBounds(s, p)) return false;
    if (p.x === 0 || p.y === 0 || p.x === s.width - 1 || p.y === s.height - 1) return p.x === start.x && p.y === start.y;
    return s.tiles[idx(s, p)] !== 'system';
  };
  const dist = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const startI = idx(s, start);
  dist[startI] = 0;
  const open = new Set<number>([startI]);
  let found = -1;
  while (open.size > 0) {
    let cur = -1;
    for (const i of open) if (cur < 0 || dist[i] < dist[cur]) cur = i;
    open.delete(cur);
    if (bridge.has(cur)) {
      found = cur;
      break;
    }
    const p = posOf(s, cur);
    for (const d of DIRS4) {
      const np = { x: p.x + d.x, y: p.y + d.y };
      if (!passable(np)) continue;
      const ni = idx(s, np);
      const nd = dist[cur] + 1 + 0.01 * offLine(np);
      if (nd < dist[ni]) {
        dist[ni] = nd;
        prev[ni] = cur;
        open.add(ni);
      }
    }
  }
  if (found < 0) return [];
  const path: Vec[] = [];
  for (let i = found; i !== startI; i = prev[i]) path.push(posOf(s, i));
  return path.reverse();
}

/** Docks the boarding vessel: Rig on the airlock, Breacher beside it, escorts around them. */
export function spawnBoss(s: GameState, b: Breach, emit: Emit): void {
  const airlock = s.airlocks.find((a) => a.id === b.airlock)!;
  // The rig takes the airlock tile (or the nearest free one).
  const rigPos = spawnTiles(s, airlock.pos, 1)[0];
  const rig = createInvader(s, 'rig', rigPos);
  s.units.push(rig);
  emit({ type: 'unitSpawned', unit: { ...rig, pos: { ...rig.pos } }, seen: true });
  const breacherPos = spawnTiles(s, airlock.pos, 1)[0];
  const breacher = createInvader(s, 'breacher', breacherPos);
  s.units.push(breacher);
  emit({ type: 'unitSpawned', unit: { ...breacher, pos: { ...breacher.pos } }, seen: true });

  if (!s.zones.some((z) => z.kind === 'tunnel')) s.zones.push({ id: 'tunnel', name: 'Drill Tunnel', kind: 'tunnel', alwaysLit: false, darkRounds: 0 });
  s.boss = { breacherId: breacher.id, rigId: rig.id, tunnel: planTunnel(s, breacher.pos), progress: 0 };
  spawnBreach(s, b, b.units, emit);
}

function drillTile(s: GameState, p: Vec): boolean {
  const i = idx(s, p);
  const t = s.tiles[i];
  if (t === 'floor' || t === 'airlock') return false;
  if (t === 'door') s.doors = s.doors.filter((d) => d.pos.x !== p.x || d.pos.y !== p.y);
  s.tiles[i] = 'floor';
  if (s.zoneOf[i] < 0 || t === 'half' || t === 'full') s.zoneOf[i] = s.zones.findIndex((z) => z.kind === 'tunnel');
  return true;
}

/** The Breacher's turn: advance the drill up to drillSpeed tiles, then fire if it can. */
export function runBoss(s: GameState, emit: Emit): void {
  const boss = s.boss;
  if (!boss) return;
  const breacher = unitById(s, boss.breacherId);
  const rig = unitById(s, boss.rigId);
  if (!breacher || !rig) return;
  breacher.ap = CONFIG.turn.apPerTurn;

  const drilled: Vec[] = [];
  for (let step = 0; step < CONFIG.boss.drillSpeed && boss.progress < boss.tunnel.length; step++) {
    const next = boss.tunnel[boss.progress];
    if (drillTile(s, next)) drilled.push({ ...next });
    const blocker = unitAt(s, next);
    if (blocker) {
      if (drilled.length) emit({ type: 'drilled', tiles: drilled.splice(0) });
      if (blocker.side === 'drone') applyDamage(s, blocker, CONFIG.boss.drillCrush, breacher.id, emit, { cause: 'drill' });
      break; // the drill is jammed for the rest of this turn
    }
    if (drilled.length) emit({ type: 'drilled', tiles: drilled.splice(0) });
    boss.progress++;
    if (!moveAlong(s, breacher, [next], emit)) return; // killed by overwatch
    if (s.status !== 'playing') return;
  }

  const target = drones(s)
    .filter((d) => canTarget(s, breacher, d))
    .sort((a, b) => previewShot(s, breacher, b).chance - previewShot(s, breacher, a).chance)[0];
  if (target) resolveShot(s, breacher, target, {}, emit);
}

/** Tiles the drill has yet to cut, for the tactical overlay. */
export function remainingTunnel(s: GameState): Vec[] {
  if (!s.boss) return [];
  return s.boss.tunnel.slice(s.boss.progress);
}

export function bossUnits(s: GameState): { breacher?: Unit; rig?: Unit } {
  if (!s.boss) return {};
  return { breacher: unitById(s, s.boss.breacherId), rig: unitById(s, s.boss.rigId) };
}
