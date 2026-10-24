// Layout and interaction state (selection, targeting, card play, hover).
// Game rules live in src/sim; this file only decides what to send.

import { useEffect, useMemo, useState } from 'react';
import {
  CARDS,
  canTarget,
  cardError,
  droneCan,
  idx,
  moveOptions,
  planIntents,
  planMove,
  scoreTilesFor,
  seenInvaderIds,
  skipToBoss,
  sightMap,
  stats,
  powerIncome,
  previewShot,
  remainingTunnel,
  repairCost,
  seedFrom,
  totalUpkeep,
  unitById,
  withinReach,
  type CardTarget,
  type GameState,
  type Unit,
  type Vec,
} from '../sim';
import { Hand } from './Hand';
import { MapView, type TileHighlight } from './MapView';
import { BossPanel, BreachPanel, BridgeBar, DronePanel, GameOver, InvaderInfo, LogList, ModuleChoice, Roster, ShotPanel, type DroneAction } from './panels';
import { toDisplay, useGame } from './useGame';

function readSeed(): number {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('seed');
  if (raw) return seedFrom(raw);
  const seed = Math.floor(Math.random() * 1_000_000);
  writeSeed(seed);
  return seed;
}

function writeSeed(seed: number) {
  const url = new URL(window.location.href);
  url.searchParams.set('seed', String(seed));
  window.history.replaceState(null, '', url);
}

const at = (u: { pos: Vec }, p: Vec) => u.pos.x === p.x && u.pos.y === p.y;

/** Turns a clicked tile into the target a card needs, if it can be one. */
function targetFromTile(s: GameState, kind: string, p: Vec): CardTarget | null {
  switch (kind) {
    case 'none':
      return { kind: 'none' };
    case 'drone': {
      const u = s.units.find((x) => at(x, p) && x.side === 'drone');
      return u ? { kind: 'unit', unitId: u.id } : null;
    }
    case 'door':
      return s.doors.some((d) => at(d, p)) ? { kind: 'door', pos: p } : null;
    case 'zone':
    case 'room': {
      const z = s.zoneOf[idx(s, p)];
      return z >= 0 ? { kind: 'zone', zone: z } : null;
    }
    case 'tile':
      return { kind: 'tile', pos: p };
  }
  return null;
}

export function App() {
  const [seed, setSeed] = useState(readSeed);
  const game = useGame(seed);
  const { state } = game;
  const [selectedId, setSelectedId] = useState<number | null>(() => state.units.find((u) => u.side === 'drone')?.id ?? null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [cardUid, setCardUid] = useState<number | null>(null);
  const [hover, setHover] = useState<Vec | null>(null);
  const [tactical, setTactical] = useState(true);
  const [debug, setDebug] = useState(false);

  const selected = selectedId !== null ? unitById(state, selectedId) : undefined;
  const drone = selected && selected.side === 'drone' ? selected : undefined;
  const pinnedTarget = targetId !== null ? unitById(state, targetId) : undefined;
  const hoverUnit = hover ? state.units.find((u) => at(u, hover)) : undefined;
  const cardInst = cardUid !== null ? state.deck.hand.find((c) => c.uid === cardUid) : undefined;
  const card = cardInst ? CARDS[cardInst.cardId] : undefined;

  const canShoot = !!drone && drone.ap > 0 && droneCan(drone, 'shoot');
  const options = useMemo(() => (drone && !game.busy && !card ? moveOptions(state, drone) : []), [state, drone, game.busy, card]);
  const targets = useMemo(
    () => (drone && canShoot && !game.busy && !card ? state.units.filter((u) => u.side === 'invader' && canTarget(state, drone, u)) : []),
    [state, drone, canShoot, game.busy, card],
  );

  // Card targeting highlights.
  const cardHighlights = useMemo((): TileHighlight[] => {
    if (!card) return [];
    const ok = (t: CardTarget) => cardError(state, card, t) === null;
    switch (card.target) {
      case 'drone':
        return state.units.filter((u) => u.side === 'drone' && ok({ kind: 'unit', unitId: u.id })).map((u) => ({ pos: u.pos, kind: 'cardTarget' }));
      case 'door':
        return state.doors.filter((d) => ok({ kind: 'door', pos: d.pos })).map((d) => ({ pos: d.pos, kind: 'cardTarget' }));
      case 'zone':
      case 'room': {
        if (!hover) return [];
        const z = state.zoneOf[idx(state, hover)];
        if (z < 0 || !ok({ kind: 'zone', zone: z })) return [];
        const out: TileHighlight[] = [];
        state.zoneOf.forEach((zi, i) => {
          if (zi === z) out.push({ pos: { x: i % state.width, y: Math.floor(i / state.width) }, kind: 'cardTarget' });
        });
        return out;
      }
      case 'tile': {
        if (!hover) return [];
        const r = card.effects.find((e) => e.kind === 'scan')?.radius ?? 0;
        const out: TileHighlight[] = [];
        for (let y = hover.y - r; y <= hover.y + r; y++)
          for (let x = hover.x - r; x <= hover.x + r; x++) if (Math.hypot(x - hover.x, y - hover.y) <= r) out.push({ pos: { x, y }, kind: 'cardTarget' });
        return out;
      }
    }
    return [];
  }, [state, card, hover]);

  const highlights: TileHighlight[] = card
    ? cardHighlights
    : [
        ...options.map((o): TileHighlight => ({ pos: o.pos, kind: o.ap === 1 ? 'move1' : 'move2' })),
        ...targets.map((t): TileHighlight => ({ pos: t.pos, kind: 'target' })),
      ];

  const hoverPlan = drone && hover && !game.busy && !hoverUnit && !card ? planMove(state, drone, hover) : null;

  // Shot preview: the pinned target, else whatever targetable invader is under the mouse.
  const shotTarget = pinnedTarget && targets.includes(pinnedTarget) ? pinnedTarget : hoverUnit && targets.includes(hoverUnit) ? hoverUnit : undefined;
  const shotPreview = drone && shotTarget ? previewShot(state, drone, shotTarget) : null;

  const sight = useMemo(() => sightMap(state), [state]);
  const seenIds = useMemo(() => seenInvaderIds(state), [state]);
  const isSeen = (u: Unit) => u.side === 'drone' || debug || seenIds.has(u.id);
  const units = game.playback ? game.playback.units : state.units.map((u) => toDisplay(u, u.side === 'drone' || seenIds.has(u.id)));

  // Tactical overlay: enemy intent (only for invaders the ship can see), weapon ranges. Debug: AI tile scores.
  const intents = useMemo(
    () => (tactical && !game.busy && state.status === 'playing' ? planIntents(state).filter((i) => debug || seenIds.has(i.unitId)) : undefined),
    [state, tactical, game.busy, debug, seenIds],
  );
  const rings: { center: Vec; radius: number; kind: 'optimal' | 'max' | 'sensor' | 'overwatch' }[] = [];
  if (drone && !game.busy) {
    rings.push({ center: drone.pos, radius: stats(drone).optimalRange, kind: 'optimal' });
    rings.push({ center: drone.pos, radius: stats(drone).maxRange, kind: 'max' });
    rings.push({ center: drone.pos, radius: stats(drone).sensor, kind: 'sensor' });
  }
  if (tactical && !game.busy)
    for (const d of state.units)
      if (d.side === 'drone' && d.overwatch && d.id !== drone?.id) rings.push({ center: d.pos, radius: stats(d).maxRange, kind: 'overwatch' });
  const scoreSubject = debug ? (pinnedTarget?.side === 'invader' ? pinnedTarget : hoverUnit?.side === 'invader' ? hoverUnit : undefined) : undefined;
  const scores = useMemo(() => (debug && scoreSubject && !game.busy ? scoreTilesFor(state, scoreSubject.id) : undefined), [debug, scoreSubject, state, game.busy]);

  const fire = (target: Unit) => {
    if (!drone) return;
    setTargetId(null);
    void game.dispatch({ type: 'shoot', unitId: drone.id, targetId: target.id });
  };

  const playCard = (uid: number, target: CardTarget) => {
    setCardUid(null);
    void game.dispatch({ type: 'playCard', uid, target });
  };

  const pickCard = (uid: number) => {
    if (game.busy) return;
    if (cardUid === uid) {
      setCardUid(null);
      return;
    }
    const inst = state.deck.hand.find((c) => c.uid === uid);
    if (!inst) return;
    const def = CARDS[inst.cardId];
    setTargetId(null);
    if (def.target === 'none') {
      playCard(uid, { kind: 'none' });
      return;
    }
    setCardUid(uid);
  };

  const onTileClick = (p: Vec) => {
    if (game.busy) return;
    if (card && cardInst) {
      const t = targetFromTile(state, card.target, p);
      if (t && cardError(state, card, t) === null) playCard(cardInst.uid, t);
      else setCardUid(null);
      return;
    }
    const clicked = state.units.find((u) => at(u, p));
    if (clicked?.side === 'drone') {
      setSelectedId(clicked.id);
      setTargetId(null);
      return;
    }
    if (clicked?.side === 'invader') {
      if (targets.includes(clicked) && targetId === clicked.id) fire(clicked);
      else setTargetId(clicked.id);
      return;
    }
    if (drone && planMove(state, drone, p)) {
      setTargetId(null);
      void game.dispatch({ type: 'move', unitId: drone.id, to: p });
      return;
    }
    setTargetId(null);
    if (!clicked) setSelectedId(null);
  };

  const endTurn = () => {
    if (game.busy) return;
    setTargetId(null);
    setCardUid(null);
    void game.dispatch({ type: 'endTurn' });
  };

  const cycleDrone = () => {
    const ds = state.units.filter((u) => u.side === 'drone');
    if (ds.length === 0) return;
    const i = ds.findIndex((d) => d.id === selectedId);
    setSelectedId(ds[(i + 1) % ds.length].id);
    setTargetId(null);
  };

  // Context actions for the selected drone.
  const droneActions: DroneAction[] = [];
  if (drone) {
    const ready = drone.ap > 0 && !game.busy;
    droneActions.push({
      label: 'Overwatch',
      key: 'O',
      enabled: ready && droneCan(drone, 'overwatch'),
      run: () => void game.dispatch({ type: 'overwatch', unitId: drone.id }),
      title: 'Spend remaining AP to react-fire at the first invader that moves into view.',
    });
    if (droneCan(drone, 'salvage')) {
      const spot = state.salvage.find((sp) => sp.charges > 0 && withinReach(drone.pos, sp.pos));
      if (spot)
        droneActions.push({
          label: `Salvage (${spot.charges} left)`,
          key: 'S',
          enabled: ready,
          run: () => void game.dispatch({ type: 'salvage', unitId: drone.id, spotId: spot.id }),
        });
    }
    if (droneCan(drone, 'haul')) {
      if (drone.carrying !== null) {
        droneActions.push({
          label: 'Drop husk',
          enabled: !game.busy,
          run: () => void game.dispatch({ type: 'drop', unitId: drone.id }),
          title: 'Hauling slows the Worker. Reach the fabricator to deliver automatically.',
        });
      } else {
        const husk = state.husks.find((h) => h.carriedBy === null && withinReach(drone.pos, h.pos));
        if (husk)
          droneActions.push({
            label: 'Pick up husk',
            key: 'H',
            enabled: ready,
            run: () => void game.dispatch({ type: 'pickUp', unitId: drone.id, huskId: husk.id }),
            title: 'Haul it to the fabricator to choose a module from its tech.',
          });
      }
    }
    if (droneCan(drone, 'repair')) {
      const sys = state.systems.find((x) => !x.working && (x.kind === 'generator' || x.kind === 'relay') && withinReach(drone.pos, x.pos));
      if (sys)
        droneActions.push({
          label: `Repair ${sys.name} (◈${repairCost(sys.kind)})`,
          key: 'R',
          enabled: ready && state.matter >= repairCost(sys.kind),
          run: () => void game.dispatch({ type: 'repair', unitId: drone.id, systemId: sys.id }),
        });
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'e') endTurn();
      else if (k === 't') setTactical((v) => !v);
      else if (k === 'd') setDebug((v) => !v);
      else if (e.key === 'Tab') {
        e.preventDefault();
        cycleDrone();
      } else if (e.key === 'Escape') {
        if (cardUid !== null) setCardUid(null);
        else if (targetId !== null) setTargetId(null);
        else setSelectedId(null);
      } else if (k === 'f' && shotTarget && pinnedTarget) fire(shotTarget);
      else if (/^[1-9]$/.test(e.key)) {
        const inst = state.deck.hand[Number(e.key) - 1];
        if (inst) pickCard(inst.uid);
      } else {
        const action = droneActions.find((a) => a.key?.toLowerCase() === k && a.enabled);
        if (action) action.run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const restartWith = (s: number) => {
    writeSeed(s);
    setSeed(s);
    game.restart(s);
    setSelectedId(null);
    setTargetId(null);
    setCardUid(null);
  };
  const newRun = () => restartWith(Math.floor(Math.random() * 1_000_000));

  const inspect = pinnedTarget?.side === 'invader' ? pinnedTarget : hoverUnit?.side === 'invader' ? hoverUnit : undefined;
  const hoverError = card && hover ? (() => {
    const t = targetFromTile(state, card.target, hover);
    return t ? cardError(state, card, t) : null;
  })() : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">COMMAND DECK · Round {state.round}</div>
        <div className="res power" title="Power refills each turn to income minus drone upkeep.">
          ⚡ {state.power}{' '}
          <span className="sub">
            power · income {powerIncome(state)} − upkeep {totalUpkeep(state)}
          </span>
        </div>
        <div className="res matter" title="Matter is banked. Salvage and kills add it; fabricating and repairs spend it.">
          ◈ {state.matter} <span className="sub">matter</span>
        </div>
        <BridgeBar state={state} />
        <div className="spacer" />
        <div className="toggles">
          <button className={tactical ? 'on' : ''} onClick={() => setTactical((v) => !v)} title="Enemy intent and weapon ranges">
            Tactical (T)
          </button>
          <button className={debug ? 'on' : ''} onClick={() => setDebug((v) => !v)} title="Reveal every invader; show AI tile scores for the invader under the mouse">
            Debug (D)
          </button>
          {debug && !state.boss && (
            <button onClick={() => game.debugReplace(skipToBoss(state), 'Skipped to the boss (regular invaders removed).')} disabled={game.busy}>
              Skip to boss
            </button>
          )}
        </div>
        <div className="seed">
          seed {seed}
          <button onClick={newRun}>New run</button>
        </div>
      </header>

      <main className="main">
        <div className="map-wrap">
          <MapView
            state={state}
            units={units}
            fx={game.fx}
            selectedId={selectedId}
            targetId={shotTarget?.id ?? null}
            highlights={highlights}
            path={hoverPlan?.path ?? null}
            pathLabel={hoverPlan ? `${hoverPlan.ap} AP` : null}
            hover={hover}
            onTileClick={onTileClick}
            onTileHover={setHover}
            onTileContext={() => {
              setCardUid(null);
              setTargetId(null);
              setSelectedId(null);
            }}
            intents={intents}
            tunnel={!game.busy ? remainingTunnel(state) : undefined}
            rings={rings}
            scores={scores}
            sight={sight}
            reveal={debug}
          />
          {card && (
            <div className="card-mode">
              Playing <b>{card.name}</b>: {card.text} <span className="muted">— click a target (Esc / right-click cancels)</span>
              {hoverError && <div className="bad">{hoverError}</div>}
            </div>
          )}
        </div>

        <aside className="side">
          <section className="panel">
            <h3>Breach countdown</h3>
            <BreachPanel state={state} />
          </section>
          {state.boss && (
            <section className="panel">
              <h3>Boss</h3>
              <BossPanel state={state} />
            </section>
          )}
          <section className="panel">
            <h3>Drone</h3>
            <DronePanel drone={drone} actions={droneActions} />
          </section>
          {drone && shotTarget && shotPreview ? (
            <section className="panel">
              <h3>Shot</h3>
              <ShotPanel shooter={drone} target={shotTarget} preview={shotPreview} onFire={pinnedTarget === shotTarget ? () => fire(shotTarget) : null} />
              {pinnedTarget !== shotTarget && <div className="muted small">Click the target to lock it, click again (or F) to fire.</div>}
            </section>
          ) : (
            inspect && (
              <section className="panel">
                <h3>Contact</h3>
                {isSeen(inspect) ? (
                  <InvaderInfo unit={inspect} />
                ) : (
                  <div className="muted">Unknown contact on the motion tracker. Light the area, get a drone's sensors on it, or Scan.</div>
                )}
              </section>
            )
          )}
          <section className="panel">
            <h3>Drones</h3>
            <Roster
              state={state}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setTargetId(null);
              }}
            />
          </section>
          <section className="panel log">
            <h3>Log</h3>
            <LogList entries={game.log} />
          </section>
        </aside>
      </main>

      <footer className="bottombar">
        <Hand
          state={state}
          selectedUid={cardUid}
          disabled={game.busy}
          onPick={pickCard}
          onDiscard={(uid) => {
            if (cardUid === uid) setCardUid(null);
            void game.dispatch({ type: 'discard', uid });
          }}
        />
        <div className="spacer" />
        <button className="end-turn" onClick={endTurn} disabled={game.busy}>
          End turn (E)
        </button>
      </footer>
      {!game.busy && <ModuleChoice state={state} onChoose={(i) => void game.dispatch({ type: 'chooseModule', index: i })} />}
      <GameOver state={state} onNewRun={newRun} onRetry={() => restartWith(seed)} />
    </div>
  );
}
