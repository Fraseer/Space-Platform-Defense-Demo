// Layout and interaction state (selection, targeting, hover). Game rules live in src/sim.

import { useEffect, useMemo, useState } from 'react';
import {
  canTarget,
  droneCan,
  moveOptions,
  planMove,
  powerIncome,
  previewShot,
  seedFrom,
  totalUpkeep,
  unitById,
  type Unit,
  type Vec,
} from '../sim';
import { MapView, type TileHighlight } from './MapView';
import { DronePanel, InvaderInfo, LogList, Roster, ShotPanel, type DroneAction } from './panels';
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

const at = (u: Unit, p: Vec) => u.pos.x === p.x && u.pos.y === p.y;

export function App() {
  const [seed, setSeed] = useState(readSeed);
  const game = useGame(seed);
  const { state } = game;
  const [selectedId, setSelectedId] = useState<number | null>(() => state.units.find((u) => u.side === 'drone')?.id ?? null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [hover, setHover] = useState<Vec | null>(null);

  const selected = selectedId !== null ? unitById(state, selectedId) : undefined;
  const drone = selected && selected.side === 'drone' ? selected : undefined;
  const pinnedTarget = targetId !== null ? unitById(state, targetId) : undefined;
  const hoverUnit = hover ? state.units.find((u) => at(u, hover)) : undefined;

  const canShoot = !!drone && drone.ap > 0 && droneCan(drone, 'shoot');
  const options = useMemo(() => (drone && !game.busy ? moveOptions(state, drone) : []), [state, drone, game.busy]);
  const targets = useMemo(
    () => (drone && canShoot && !game.busy ? state.units.filter((u) => u.side === 'invader' && canTarget(state, drone, u)) : []),
    [state, drone, canShoot, game.busy],
  );

  const highlights: TileHighlight[] = [
    ...options.map((o): TileHighlight => ({ pos: o.pos, kind: o.ap === 1 ? 'move1' : 'move2' })),
    ...targets.map((t): TileHighlight => ({ pos: t.pos, kind: 'target' })),
  ];

  const hoverPlan = drone && hover && !game.busy && !hoverUnit ? planMove(state, drone, hover) : null;

  // Shot preview: the pinned target, else whatever targetable invader is under the mouse.
  const shotTarget = pinnedTarget && targets.includes(pinnedTarget) ? pinnedTarget : hoverUnit && targets.includes(hoverUnit) ? hoverUnit : undefined;
  const shotPreview = drone && shotTarget ? previewShot(state, drone, shotTarget) : null;

  const units = game.playback ? game.playback.units : state.units.map((u) => toDisplay(u));

  const fire = (target: Unit) => {
    if (!drone) return;
    setTargetId(null);
    void game.dispatch({ type: 'shoot', unitId: drone.id, targetId: target.id });
  };

  const onTileClick = (p: Vec) => {
    if (game.busy) return;
    const clicked = state.units.find((u) => at(u, p));
    if (clicked?.side === 'drone') {
      setSelectedId(clicked.id);
      setTargetId(null);
      return;
    }
    if (clicked?.side === 'invader') {
      if (targets.includes(clicked)) {
        if (targetId === clicked.id) fire(clicked);
        else setTargetId(clicked.id);
      } else setTargetId(clicked.id);
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
    void game.dispatch({ type: 'endTurn' });
  };

  const overwatch = () => {
    if (drone && !game.busy) void game.dispatch({ type: 'overwatch', unitId: drone.id });
  };

  const cycleDrone = () => {
    const ds = state.units.filter((u) => u.side === 'drone');
    if (ds.length === 0) return;
    const i = ds.findIndex((d) => d.id === selectedId);
    setSelectedId(ds[(i + 1) % ds.length].id);
    setTargetId(null);
  };

  const droneActions: DroneAction[] = drone
    ? [
        { label: 'Overwatch', key: 'O', enabled: drone.ap > 0 && !game.busy && droneCan(drone, 'overwatch'), run: overwatch, title: 'Spend remaining AP to react-fire at the first invader that moves into view.' },
      ]
    : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E') endTurn();
      else if (e.key === 'Tab') {
        e.preventDefault();
        cycleDrone();
      } else if (e.key === 'Escape') {
        if (targetId !== null) setTargetId(null);
        else setSelectedId(null);
      } else if ((e.key === 'f' || e.key === 'F') && shotTarget && pinnedTarget) fire(shotTarget);
      else if (e.key === 'o' || e.key === 'O') overwatch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const newRun = () => {
    const s = Math.floor(Math.random() * 1_000_000);
    writeSeed(s);
    setSeed(s);
    game.restart(s);
    setSelectedId(null);
    setTargetId(null);
  };

  const inspect = pinnedTarget?.side === 'invader' ? pinnedTarget : hoverUnit?.side === 'invader' ? hoverUnit : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">COMMAND DECK · Round {state.round}</div>
        <div className="res power" title={`Income ${powerIncome(state)} − upkeep ${totalUpkeep(state)}`}>
          ⚡ {state.power} <span className="sub">power</span>
        </div>
        <div className="res matter">
          ◈ {state.matter} <span className="sub">matter</span>
        </div>
        <div className="spacer" />
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
              setTargetId(null);
              setSelectedId(null);
            }}
          />
        </div>

        <aside className="side">
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
                <InvaderInfo unit={inspect} />
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
        <div className="spacer" />
        <button className="end-turn" onClick={endTurn} disabled={game.busy}>
          End turn (E)
        </button>
      </footer>
    </div>
  );
}
