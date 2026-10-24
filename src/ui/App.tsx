// Layout and interaction state (selection, hover). Game rules live in src/sim.

import { useEffect, useMemo, useState } from 'react';
import { CONFIG, DRONES, moveOptions, planMove, powerIncome, seedFrom, stats, totalUpkeep, unitById, type Vec } from '../sim';
import { MapView, type TileHighlight } from './MapView';
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

export function App() {
  const [seed, setSeed] = useState(readSeed);
  const game = useGame(seed);
  const { state } = game;
  const [selectedId, setSelectedId] = useState<number | null>(() => state.units.find((u) => u.side === 'drone')?.id ?? null);
  const [hover, setHover] = useState<Vec | null>(null);

  const selected = selectedId !== null ? unitById(state, selectedId) : undefined;
  const selectedDrone = selected && selected.side === 'drone' ? selected : undefined;

  const options = useMemo(() => (selectedDrone && !game.busy ? moveOptions(state, selectedDrone) : []), [state, selectedDrone, game.busy]);

  const highlights: TileHighlight[] = options.map((o) => ({ pos: o.pos, kind: o.ap === 1 ? 'move1' : 'move2' }));

  const hoverPlan = selectedDrone && hover && !game.busy ? planMove(state, selectedDrone, hover) : null;

  const units = game.playback ? game.playback.units : state.units.map((u) => toDisplay(u));

  const onTileClick = (p: Vec) => {
    if (game.busy) return;
    const clicked = state.units.find((u) => u.pos.x === p.x && u.pos.y === p.y);
    if (clicked && clicked.side === 'drone') {
      setSelectedId(clicked.id);
      return;
    }
    if (selectedDrone && planMove(state, selectedDrone, p)) {
      void game.dispatch({ type: 'move', unitId: selectedDrone.id, to: p });
      return;
    }
    if (!clicked) setSelectedId(null);
  };

  const endTurn = () => {
    if (!game.busy) void game.dispatch({ type: 'endTurn' });
  };

  const cycleDrone = () => {
    const ds = state.units.filter((u) => u.side === 'drone');
    if (ds.length === 0) return;
    const i = ds.findIndex((d) => d.id === selectedId);
    setSelectedId(ds[(i + 1) % ds.length].id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E') endTurn();
      else if (e.key === 'Tab') {
        e.preventDefault();
        cycleDrone();
      } else if (e.key === 'Escape') setSelectedId(null);
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
  };

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
            fx={game.playback?.fx ?? []}
            selectedId={selectedId}
            highlights={highlights}
            path={hoverPlan?.path ?? null}
            pathLabel={hoverPlan ? `${hoverPlan.ap} AP` : null}
            hover={hover}
            onTileClick={onTileClick}
            onTileHover={setHover}
          />
        </div>

        <aside className="side">
          <section className="panel">
            <h3>Drone</h3>
            {selectedDrone ? (
              <div className="unit">
                <div className="unit-name">{selectedDrone.name}</div>
                <div className="unit-type">
                  {DRONES[selectedDrone.type as 'sentry' | 'worker'].name} · kills {selectedDrone.kills}
                </div>
                <div className="unit-stats">
                  HP {selectedDrone.hp}/{selectedDrone.maxHp} · AP {selectedDrone.ap}/{CONFIG.turn.apPerTurn} · move {stats(selectedDrone).move}
                </div>
              </div>
            ) : (
              <div className="muted">Click a drone (Tab cycles).</div>
            )}
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

function LogList({ entries }: { entries: { id: number; text: string; tone: string }[] }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (el) el.scrollTop = el.scrollHeight;
  }, [el, entries.length]);
  return (
    <div className="log-list" ref={setEl}>
      {entries.map((e) => (
        <div key={e.id} className={`log-line tone-${e.tone}`}>
          {e.text}
        </div>
      ))}
    </div>
  );
}
