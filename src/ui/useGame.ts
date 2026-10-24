// Holds the game state, sends commands to the simulation and plays the
// resulting events back as animation. The UI never changes game state itself.

import { useCallback, useRef, useState } from 'react';
import { applyCommand, describeEvent, newGame, wakeUpEvents, type Command, type GameEvent, type GameState, type Unit, type Vec } from '../sim';

export interface LogEntry {
  id: number;
  text: string;
  tone: 'info' | 'warn' | 'good' | 'bad';
}

/** What the map draws for a unit while events play back. */
export interface DisplayUnit {
  id: number;
  side: Unit['side'];
  type: Unit['type'];
  name: string;
  pos: Vec;
  hp: number;
  maxHp: number;
  /** False while an invader is hidden from the ship (shown as a blip). */
  seen: boolean;
}

export type Fx =
  | { id: number; kind: 'shot'; from: Vec; to: Vec; hit: boolean; side: Unit['side'] }
  | { id: number; kind: 'float'; at: Vec; text: string; tone: 'hit' | 'graze' | 'heal' | 'info' };

export interface Playback {
  units: DisplayUnit[];
  fx: Fx[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function toDisplay(u: Unit, seen = true): DisplayUnit {
  return { id: u.id, side: u.side, type: u.type, name: u.name, pos: { ...u.pos }, hp: u.hp, maxHp: u.maxHp, seen };
}

let logId = 1;
let fxId = 1;

function logFrom(events: GameEvent[], s: GameState): LogEntry[] {
  const out: LogEntry[] = [];
  for (const e of events) {
    const line = describeEvent(e, s);
    if (line) out.push({ id: logId++, ...line });
  }
  return out;
}

export function useGame(seed: number) {
  const [state, setState] = useState<GameState>(() => newGame(seed));
  const [log, setLog] = useState<LogEntry[]>(() => logFrom(wakeUpEvents(state), state));
  const [playback, setPlayback] = useState<Playback | null>(null);
  const busy = useRef(false);
  const fast = useRef(false);

  const pushLog = useCallback((entries: LogEntry[]) => {
    if (entries.length) setLog((l) => [...l, ...entries].slice(-300));
  }, []);

  const play = useCallback(
    async (prev: GameState, next: GameState, events: GameEvent[]) => {
      // Lookup state for names: units that died this command are only in `prev`.
      const names: GameState = { ...next, units: [...next.units, ...prev.units.filter((u) => !next.units.some((n) => n.id === u.id))] };
      const model = new Map<number, DisplayUnit>(prev.units.map((u) => [u.id, toDisplay(u)]));
      let fx: Fx[] = [];
      const render = () => setPlayback({ units: [...model.values()].map((u) => ({ ...u, pos: { ...u.pos } })), fx: [...fx] });
      const addFx = (f: Fx, ttl: number) => {
        fx = [...fx, f];
        render();
        setTimeout(() => {
          fx = fx.filter((x) => x.id !== f.id);
          render();
        }, ttl);
      };
      const wait = (ms: number) => sleep(fast.current ? ms / 4 : ms);

      render();
      for (const e of events) {
        pushLog(logFrom([e], names));
        switch (e.type) {
          case 'unitMoved': {
            const u = model.get(e.unitId);
            if (!u) break;
            const stepMs = u.side === 'drone' ? 70 : 45;
            for (let i = 0; i < e.path.length; i++) {
              u.pos = { ...e.path[i] };
              if (e.seen) u.seen = e.seen[i];
              render();
              await wait(stepMs);
            }
            break;
          }
          case 'enemyPhase':
            await wait(150);
            break;
          default:
            break;
        }
      }
      void addFx;
      setState(next);
      setPlayback(null);
    },
    [pushLog],
  );

  const dispatch = useCallback(
    async (cmd: Command): Promise<boolean> => {
      if (busy.current) return false;
      const result = applyCommand(state, cmd);
      if (!result.ok) {
        pushLog([{ id: logId++, text: result.error ?? 'Not allowed.', tone: 'bad' }]);
        return false;
      }
      busy.current = true;
      try {
        await play(state, result.state, result.events);
      } finally {
        busy.current = false;
      }
      return true;
    },
    [state, play, pushLog],
  );

  const restart = useCallback(
    (newSeed: number) => {
      const s = newGame(newSeed);
      setState(s);
      setPlayback(null);
      setLog(logFrom(wakeUpEvents(s), s));
    },
    [],
  );

  return { state, log, playback, busy: playback !== null, dispatch, restart, fast, nextFxId: () => fxId++ };
}
