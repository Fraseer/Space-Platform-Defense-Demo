// Side-panel widgets. Read-only views of state; actions go through callbacks.

import { useEffect, useState } from 'react';
import { CONFIG, DRONES, INVADERS, stats, type GameState, type InvaderType, type ShotPreview, type Unit } from '../sim';

import type { LogEntry } from './useGame';

export interface DroneAction {
  label: string;
  key?: string;
  enabled: boolean;
  title?: string;
  run: () => void;
}

export function DronePanel({ drone, actions }: { drone: Unit | undefined; actions: DroneAction[] }) {
  if (!drone) return <div className="muted">Click a drone (Tab cycles).</div>;
  const st = stats(drone);
  return (
    <div className="unit">
      <div className="unit-name">
        {drone.name} {drone.overwatch && <span className="tag ow">OVERWATCH</span>}
      </div>
      <div className="unit-type">
        {DRONES[drone.type as 'sentry' | 'worker'].name} · {drone.kills} kill{drone.kills === 1 ? '' : 's'}
      </div>
      <div className="unit-stats">
        HP {drone.hp}/{drone.maxHp} · AP {drone.ap} · move {st.move} · aim {st.aim} · dmg {st.damage} · range {st.optimalRange}/{st.maxRange}
      </div>
      {drone.modules.length > 0 && <div className="unit-modules">Modules: {drone.modules.join(', ')}</div>}
      <div className="actions">
        {actions.map((a) => (
          <button key={a.label} disabled={!a.enabled} onClick={a.run} title={a.title}>
            {a.label}
            {a.key ? ` (${a.key})` : ''}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ShotPanel({ shooter, target, preview, onFire }: { shooter: Unit; target: Unit; preview: ShotPreview; onFire: (() => void) | null }) {
  return (
    <div className="shot">
      <div className="shot-head">
        {shooter.name} → {target.name}
        {preview.flanked && <span className="tag flank">FLANKED</span>}
      </div>
      <div className="shot-chance">{preview.chance}%</div>
      <table className="breakdown">
        <tbody>
          {preview.modifiers.map((m, i) => (
            <tr key={i}>
              <td>{m.label}</td>
              <td className={m.value >= 0 ? 'pos' : 'neg'}>
                {i === 0 ? m.value : `${m.value > 0 ? '+' : ''}${m.value}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="shot-dmg">
        Hit: {preview.damage} dmg · Miss: graze {preview.grazeDamage} dmg · target HP {target.hp}
      </div>
      {onFire && (
        <button className="fire" onClick={onFire}>
          Fire (F)
        </button>
      )}
    </div>
  );
}

export function InvaderInfo({ unit }: { unit: Unit }) {
  const def = INVADERS[unit.type as InvaderType];
  return (
    <div className="unit">
      <div className="unit-name invader">{def.name}</div>
      <div className="unit-stats">
        HP {unit.hp}/{unit.maxHp} · move {stats(unit).move} · aim {stats(unit).aim} · dmg {stats(unit).damage}
      </div>
      <div className="muted">{def.blurb}</div>
    </div>
  );
}

export function Roster({ state, selectedId, onSelect }: { state: GameState; selectedId: number | null; onSelect: (id: number) => void }) {
  const ds = state.units.filter((u) => u.side === 'drone');
  return (
    <div className="roster">
      {ds.map((d) => (
        <div key={d.id} className={`roster-row ${d.id === selectedId ? 'sel' : ''}`} onClick={() => onSelect(d.id)}>
          <span className="r-name">{d.name}</span>
          <span>
            HP {d.hp}/{d.maxHp}
          </span>
          <span>AP {d.ap}</span>
          <span>☠ {d.kills}</span>
          <span className="r-ow">{d.overwatch ? 'OW' : d.ap > 0 && !d.acted ? '·' : ''}</span>
        </div>
      ))}
      {ds.length === 0 && <div className="muted">No drones. Fabricate one.</div>}
      <div className="muted small">Upkeep {ds.reduce((s, d) => s + stats(d).upkeep, 0)} power/turn · {CONFIG.turn.apPerTurn} AP each</div>
    </div>
  );
}

export function LogList({ entries }: { entries: LogEntry[] }) {
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
