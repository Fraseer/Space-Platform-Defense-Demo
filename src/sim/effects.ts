// Card play: target validation, paying costs, and the effect interpreter.

import { CONFIG } from './config';
import { killUnit } from './combat';
import { CARDS, type CardDef, type Effect } from './content/cards';
import { INVADERS } from './content/units';
import { DIRS4, doorAt, idx, inBounds, isWalkable, unitAt } from './grid';
import { gainMatter } from './economy';
import { createDrone, hasModule, stats, unitById } from './units';
import type { Emit } from './actions';
import type { CardTarget, DroneType, GameState, InvaderType, Unit, Vec } from './types';

/** Free tile next to the fabricator where a new drone appears, or null. */
export function fabricatorSpawnTile(s: GameState): Vec | null {
  const fab = s.systems.find((x) => x.kind === 'fabricator' && x.working);
  if (!fab) return null;
  const around = [...DIRS4, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }];
  for (const d of around) {
    const p = { x: fab.pos.x + d.x, y: fab.pos.y + d.y };
    if (inBounds(s, p) && isWalkable(s, p) && !unitAt(s, p)) return p;
  }
  return null;
}

export function zoneTiles(s: GameState, zone: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.zoneOf.length; i++) if (s.zoneOf[i] === zone) out.push(i);
  return out;
}

function targetDrone(s: GameState, t: CardTarget): Unit | undefined {
  if (t.kind !== 'unit') return undefined;
  const u = unitById(s, t.unitId);
  return u?.side === 'drone' ? u : undefined;
}

/** Why this card can't be played on this target right now, or null if it can. */
export function cardError(s: GameState, card: CardDef, t: CardTarget): string | null {
  if (s.power < card.cost.power) return `Not enough power (${card.cost.power} needed).`;
  if ((card.cost.matter ?? 0) > s.matter) return `Not enough matter (${card.cost.matter} needed).`;

  switch (card.target) {
    case 'none':
      if (t.kind !== 'none') return 'This card has no target.';
      break;
    case 'drone':
      if (!targetDrone(s, t)) return 'Pick one of your drones.';
      break;
    case 'door': {
      if (t.kind !== 'door' || !doorAt(s, t.pos)) return 'Pick a door.';
      if (unitAt(s, t.pos)) return 'Something is standing in that doorway.';
      break;
    }
    case 'zone':
    case 'room': {
      if (t.kind !== 'zone' || !s.zones[t.zone]) return card.target === 'room' ? 'Pick a room.' : 'Pick a room or corridor.';
      const z = s.zones[t.zone];
      if (z.kind === 'bridge') return 'Not the bridge.';
      if (card.target === 'room' && z.kind !== 'room') return 'Pick a room, not a corridor.';
      break;
    }
    case 'tile':
      if (t.kind !== 'tile' || !inBounds(s, t.pos)) return 'Pick a tile.';
      break;
  }

  for (const e of card.effects) {
    const err = effectError(s, e, t);
    if (err) return err;
  }
  return null;
}

function effectError(s: GameState, e: Effect, t: CardTarget): string | null {
  const d = targetDrone(s, t);
  switch (e.kind) {
    case 'spawn':
      if (!fabricatorSpawnTile(s)) return 'The fabricator is blocked.';
      return null;
    case 'heal':
      if (d && d.hp >= d.maxHp) return `${d.name} is undamaged.`;
      return null;
    case 'installModule':
      if (d && hasModule(d, e.module)) return `${d.name} already has that module.`;
      return null;
    default:
      return null;
  }
}

export function playCard(s: GameState, uid: number, t: CardTarget, emit: Emit): void {
  const handIndex = s.deck.hand.findIndex((c) => c.uid === uid);
  const inst = s.deck.hand[handIndex];
  const card = CARDS[inst.cardId];
  s.deck.hand.splice(handIndex, 1);
  (card.exhaust ? s.deck.exhausted : s.deck.discard).push(inst);
  s.stats.cardsPlayed++;

  s.power -= card.cost.power;
  emit({ type: 'cardPlayed', cardId: card.id, uid });
  if (card.cost.power > 0) emit({ type: 'powerChanged', power: s.power, reason: card.name });
  if (card.cost.matter) {
    s.matter -= card.cost.matter;
    emit({ type: 'matterChanged', matter: s.matter, delta: -card.cost.matter, reason: card.name });
  }
  for (const e of card.effects) applyEffect(s, e, t, emit);
}

function applyEffect(s: GameState, e: Effect, t: CardTarget, emit: Emit): void {
  const d = targetDrone(s, t);
  switch (e.kind) {
    case 'gainPower':
      s.power += e.amount;
      emit({ type: 'powerChanged', power: s.power, reason: 'rerouted' });
      return;
    case 'gainAp':
      if (!d) return;
      d.ap += e.amount;
      emit({ type: 'apGained', unitId: d.id, amount: e.amount });
      return;
    case 'applyStatus':
      if (!d) return;
      if (e.status === 'aimBonus') d.aimBonus += e.value;
      if (e.status === 'disableNext') d.disableNext = true;
      emit({ type: 'log', text: `${d.name}: ${e.status === 'aimBonus' ? `+${e.value}% aim on next shot` : 'next lethal shot disables'}.`, tone: 'info' });
      return;
    case 'heal': {
      if (!d) return;
      const amount = Math.min(e.amount, d.maxHp - d.hp);
      d.hp += amount;
      emit({ type: 'healed', unitId: d.id, amount });
      return;
    }
    case 'spawn': {
      const pos = fabricatorSpawnTile(s)!;
      const drone = createDrone(s, e.drone, pos);
      drone.ap = CONFIG.turn.fabricatedAp;
      s.units.push(drone);
      s.stats.dronesBuilt++;
      emit({ type: 'unitSpawned', unit: { ...drone, pos: { ...drone.pos } }, seen: true });
      return;
    }
    case 'seal': {
      if (t.kind !== 'door') return;
      const door = doorAt(s, t.pos)!;
      door.sealedRounds = e.rounds;
      emit({ type: 'doorSealed', pos: { ...door.pos }, rounds: e.rounds });
      return;
    }
    case 'darken': {
      if (t.kind !== 'zone') return;
      s.zones[t.zone].darkRounds = e.rounds;
      emit({ type: 'zoneDarkened', zone: t.zone, rounds: e.rounds });
      return;
    }
    case 'vent': {
      if (t.kind !== 'zone') return;
      emit({ type: 'zoneVented', zone: t.zone });
      const tiles = new Set(zoneTiles(s, t.zone));
      const victims = s.units.filter((u) => tiles.has(idx(s, u.pos)) && !(u.side === 'invader' && INVADERS[u.type as InvaderType].anchored));
      for (const v of victims) killUnit(s, v, null, emit, { cause: 'vent' });
      s.husks = s.husks.filter((h) => h.carriedBy !== null || !tiles.has(idx(s, h.pos)));
      return;
    }
    case 'scan': {
      if (t.kind !== 'tile') return;
      s.scans.push({ center: { ...t.pos }, radius: e.radius });
      emit({ type: 'scanned', center: { ...t.pos }, radius: e.radius });
      return;
    }
    case 'recycle': {
      if (!d) return;
      const refund = Math.floor(CONFIG.drones[d.type as DroneType].matterCost * e.refundRatio);
      killUnit(s, d, null, emit, { cause: 'recycle' });
      gainMatter(s, refund);
      emit({ type: 'matterChanged', matter: s.matter, delta: refund, reason: `${d.name} recycled` });
      return;
    }
    case 'installModule': {
      if (!d) return;
      const before = stats(d).maxHp;
      d.modules.push(e.module);
      const after = stats(d).maxHp;
      d.maxHp = after;
      d.hp = Math.max(1, Math.min(after, d.hp + Math.max(0, after - before)));
      emit({ type: 'moduleInstalled', unitId: d.id, moduleId: e.module });
      return;
    }
  }
}

/** Scraps a card from the hand to the discard pile (limited per turn). */
export function discardCard(s: GameState, uid: number, emit: Emit): void {
  const i = s.deck.hand.findIndex((c) => c.uid === uid);
  const [inst] = s.deck.hand.splice(i, 1);
  s.deck.discard.push(inst);
  s.discardsLeft--;
  emit({ type: 'cardDiscarded', cardId: inst.cardId, uid });
}
