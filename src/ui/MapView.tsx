// Top-down SVG grid. Placeholder shapes: cyan drones, orange invaders.

import { memo } from 'react';
import type { GameState, Intent, TileScore, Vec } from '../sim';
import type { DisplayUnit, Fx } from './useGame';

export const TILE = 28;

export interface TileHighlight {
  pos: Vec;
  kind: 'move1' | 'move2' | 'target' | 'cardTarget' | 'range';
}

interface Props {
  state: GameState;
  units: DisplayUnit[];
  fx: Fx[];
  selectedId: number | null;
  targetId: number | null;
  highlights: TileHighlight[];
  path: Vec[] | null;
  pathLabel: string | null;
  hover: Vec | null;
  onTileClick: (p: Vec) => void;
  onTileHover: (p: Vec | null) => void;
  onTileContext?: (p: Vec) => void;
  sight: (0 | 1 | 2)[];
  /** Debug: draw blips as the units they are. */
  reveal: boolean;
  intents?: Intent[];
  /** Tiles the boss drill has yet to cut. */
  tunnel?: Vec[];
  rings?: { center: Vec; radius: number; kind: 'optimal' | 'max' | 'sensor' | 'overwatch' }[];
  scores?: TileScore[];
}

const center = (p: Vec) => ({ x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2 });

function IntentLayer({ state, intents }: { state: GameState; intents: Intent[] }) {
  return (
    <g pointerEvents="none">
      {intents.map((it) => {
        const pts = [it.from, ...it.path].map(center);
        const end = pts[pts.length - 1];
        const target = it.action?.kind === 'shoot' ? state.units.find((u) => u.id === (it.action as { targetId: number }).targetId) : undefined;
        const sys = it.action?.kind === 'sabotage' ? state.systems.find((x) => x.id === (it.action as { systemId: number }).systemId) : undefined;
        return (
          <g key={it.unitId}>
            {pts.length > 1 && (
              <>
                <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ff8a2a" strokeWidth={1.6} strokeDasharray="4 3" opacity={0.85} />
                <circle cx={end.x} cy={end.y} r={4} fill="none" stroke="#ff8a2a" strokeWidth={1.5} />
              </>
            )}
            {target && (
              <line x1={end.x} y1={end.y} x2={center(target.pos).x} y2={center(target.pos).y} stroke="#ff5d5d" strokeWidth={1.4} strokeDasharray="2 3" />
            )}
            {sys && (
              <text x={center(sys.pos).x} y={center(sys.pos).y - 12} textAnchor="middle" fontSize={13} fill="#ff5d5d" fontWeight={700}>
                ⚠
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

const C = {
  floor: '#11161c',
  floorLit: '#1b242e',
  floorBridge: '#1c2b36',
  floorSensed: '#0e171c',
  floorDark: '#07090c',
  wall: '#36404c',
  wallEdge: '#36404c',
  door: '#4b5866',
  half: '#3c4652',
  full: '#56606c',
  drone: '#3fe0ff',
  invader: '#ff8a2a',
  salvage: '#c8b26a',
};

const StaticTiles = memo(function StaticTiles({ state, sight }: { state: GameState; sight: (0 | 1 | 2)[] }) {
  const out: React.ReactNode[] = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const i = y * state.width + x;
      const t = state.tiles[i];
      const px = x * TILE;
      const py = y * TILE;
      const zone = state.zones[state.zoneOf[i]];
      if (t === 'wall') {
        out.push(<rect key={i} x={px} y={py} width={TILE} height={TILE} fill={C.wall} stroke={C.wallEdge} strokeWidth={0.5} />);
        continue;
      }
      const v = sight[i];
      let floor = v === 2 ? (zone?.kind === 'bridge' ? C.floorBridge : C.floorLit) : v === 1 ? C.floorSensed : C.floorDark;
      if (zone?.kind === 'tunnel') floor = v === 0 ? '#140d08' : '#2a1b10';
      out.push(<rect key={i} x={px} y={py} width={TILE} height={TILE} fill={floor} stroke={v === 0 ? '#0b0e12' : '#0c1015'} strokeWidth={0.5} />);
      const dim = v === 0 ? 0.45 : 1;
      if (t === 'half') out.push(<rect key={`c${i}`} x={px + 5} y={py + 9} width={TILE - 10} height={TILE - 18} rx={2} fill={C.half} opacity={dim} />);
      if (t === 'full') out.push(<rect key={`c${i}`} x={px + 4} y={py + 4} width={TILE - 8} height={TILE - 8} rx={2} fill={C.full} opacity={dim} />);
    }
  }
  return <g>{out}</g>;
});

function Doors({ state }: { state: GameState }) {
  return (
    <g>
      {state.doors.map((d) => {
        const px = d.pos.x * TILE;
        const py = d.pos.y * TILE;
        // Doors in a horizontal wall run (walls left and right) are drawn horizontally.
        const left = state.tiles[d.pos.y * state.width + d.pos.x - 1];
        const horizontal = left === 'wall';
        const sealed = d.sealedRounds > 0;
        const color = sealed ? '#d94a4a' : C.door;
        return horizontal ? (
          <rect key={`${d.pos.x},${d.pos.y}`} x={px} y={py + TILE / 2 - 2} width={TILE} height={4} fill={color} opacity={sealed ? 1 : 0.8} />
        ) : (
          <rect key={`${d.pos.x},${d.pos.y}`} x={px + TILE / 2 - 2} y={py} width={4} height={TILE} fill={color} opacity={sealed ? 1 : 0.8} />
        );
      })}
    </g>
  );
}

function Systems({ state }: { state: GameState }) {
  return (
    <g>
      {state.systems.map((s) => {
        const cx = s.pos.x * TILE + TILE / 2;
        const cy = s.pos.y * TILE + TILE / 2;
        const color = s.working ? '#7fe7c4' : '#6b6f75';
        const label = s.kind === 'fabricator' ? 'F' : s.kind === 'generator' ? 'G' : s.kind === 'relay' ? 'R' : '◆';
        return (
          <g key={s.id}>
            <rect x={cx - TILE / 2 + 2} y={cy - TILE / 2 + 2} width={TILE - 4} height={TILE - 4} rx={4} fill="#1d262f" stroke={color} strokeWidth={1.5} strokeDasharray={s.working ? undefined : '3 2'} />
            <text x={cx} y={cy + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill={color}>
              {label}
            </text>
          </g>
        );
      })}
      {state.salvage
        .filter((sp) => sp.charges > 0)
        .map((sp) => (
          <g key={sp.id}>
            <circle cx={sp.pos.x * TILE + TILE / 2} cy={sp.pos.y * TILE + TILE / 2} r={5} fill="none" stroke={C.salvage} strokeWidth={1.5} />
            <circle cx={sp.pos.x * TILE + TILE / 2} cy={sp.pos.y * TILE + TILE / 2} r={1.8} fill={C.salvage} />
          </g>
        ))}
      {state.airlocks.map((a) => (
        <g key={a.id}>
          <rect x={a.pos.x * TILE + 1} y={a.pos.y * TILE + 1} width={TILE - 2} height={TILE - 2} fill="#2a1c12" stroke="#a8571c" strokeWidth={1.5} />
          <text x={a.pos.x * TILE + TILE / 2} y={a.pos.y * TILE + TILE / 2 + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill="#ff9d4d">
            {a.id}
          </text>
        </g>
      ))}
    </g>
  );
}

function Blip({ u }: { u: DisplayUnit }) {
  const cx = u.pos.x * TILE + TILE / 2;
  const cy = u.pos.y * TILE + TILE / 2;
  return (
    <g transform={`translate(${cx},${cy})`} style={{ transition: 'transform 60ms linear' }}>
      <circle r={9} className="blip-pulse" />
      <circle r={3} fill="#ff8a2a" />
    </g>
  );
}

function UnitShape({ u, selected, targeted, reveal }: { u: DisplayUnit; selected: boolean; targeted: boolean; reveal: boolean }) {
  if (!u.seen && !reveal) return <Blip u={u} />;
  const cx = u.pos.x * TILE + TILE / 2;
  const cy = u.pos.y * TILE + TILE / 2;
  const color = u.side === 'drone' ? C.drone : C.invader;
  let shape: React.ReactNode;
  switch (u.type) {
    case 'sentry':
      shape = <polygon points={`0,-10 10,0 0,10 -10,0`} fill={color} />;
      break;
    case 'worker':
      shape = <circle r={8} fill={color} />;
      break;
    case 'runner':
      shape = <polygon points={`0,-9 8,7 -8,7`} fill={color} />;
      break;
    case 'brute':
      shape = <rect x={-10} y={-10} width={20} height={20} rx={2} fill={color} />;
      break;
    case 'saboteur':
      shape = <polygon points={`-5,-9 5,-9 10,0 5,9 -5,9 -10,0`} fill={color} />;
      break;
    case 'breacher':
      shape = <polygon points={`-6,-12 6,-12 12,-6 12,6 6,12 -6,12 -12,6 -12,-6`} fill={color} stroke="#ffd2a6" strokeWidth={1.5} />;
      break;
    case 'rig':
      shape = (
        <g>
          <rect x={-11} y={-11} width={22} height={22} fill="none" stroke={color} strokeWidth={3} />
          <path d="M-8,-8 L8,8 M8,-8 L-8,8" stroke={color} strokeWidth={3} />
        </g>
      );
      break;
  }
  const pips = [];
  const pipW = Math.min(4, 22 / u.maxHp);
  for (let i = 0; i < u.maxHp; i++) {
    pips.push(<rect key={i} x={-11 + i * pipW} y={-15} width={Math.max(pipW - 0.6, 0.8)} height={2.5} fill={i < u.hp ? color : '#333a42'} />);
  }
  return (
    <g transform={`translate(${cx},${cy})`} style={{ transition: 'transform 60ms linear' }}>
      {selected && <circle r={13} fill="none" stroke="#e8fbff" strokeWidth={1.5} strokeDasharray="4 3" />}
      {!u.seen && <circle r={14} fill="none" stroke="#ff8a2a" strokeWidth={0.8} strokeDasharray="1 2" />}
      {targeted && (
        <g stroke="#ff5d5d" strokeWidth={1.8}>
          <circle r={13} fill="none" />
          <path d="M0,-17 L0,-11 M0,11 L0,17 M-17,0 L-11,0 M11,0 L17,0" />
        </g>
      )}
      {u.overwatch && <path d="M-11,9 Q0,15 11,9" fill="none" stroke="#e8fbff" strokeWidth={1.6} />}
      {shape}
      <g>{pips}</g>
      {u.carrying && <rect x={-13} y={4} width={8} height={8} fill="#2a1c12" stroke="#ff8a2a" strokeWidth={1.4} />}
      {u.side === 'drone' && u.kills > 0 && (
        <text x={10} y={13} fontSize={8} fontWeight={700} fill="#e8fbff">
          {u.kills}
        </text>
      )}
    </g>
  );
}

export function MapView(p: Props) {
  const { state } = p;
  const w = state.width * TILE;
  const h = state.height * TILE;
  const toTile = (e: React.MouseEvent<SVGSVGElement>): Vec | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * state.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * state.height);
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
    return { x, y };
  };
  return (
    <svg
      className="map"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      onClick={(e) => {
        const t = toTile(e);
        if (t) p.onTileClick(t);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        const t = toTile(e);
        if (t && p.onTileContext) p.onTileContext(t);
      }}
      onMouseMove={(e) => {
        const t = toTile(e);
        if (!p.hover || !t || t.x !== p.hover.x || t.y !== p.hover.y) p.onTileHover(t);
      }}
      onMouseLeave={() => p.onTileHover(null)}
    >
      <rect width={w} height={h} fill="#07090c" />
      <StaticTiles state={state} sight={p.sight} />
      <Doors state={state} />
      <Systems state={state} />
      <g>
        {p.highlights.map((hl, i) => (
          <rect
            key={i}
            x={hl.pos.x * TILE + 1}
            y={hl.pos.y * TILE + 1}
            width={TILE - 2}
            height={TILE - 2}
            className={`hl hl-${hl.kind}`}
          />
        ))}
      </g>
      {p.path && p.path.length > 0 && (
        <g>
          <polyline
            points={p.path.map((q) => `${q.x * TILE + TILE / 2},${q.y * TILE + TILE / 2}`).join(' ')}
            fill="none"
            stroke="#bff6ff"
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          {p.pathLabel && (
            <text
              x={p.path[p.path.length - 1].x * TILE + TILE / 2}
              y={p.path[p.path.length - 1].y * TILE - 3}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill="#bff6ff"
            >
              {p.pathLabel}
            </text>
          )}
        </g>
      )}
      {p.hover && <rect x={p.hover.x * TILE} y={p.hover.y * TILE} width={TILE} height={TILE} fill="none" stroke="#ffffff55" strokeWidth={1} pointerEvents="none" />}
      {p.rings && (
        <g pointerEvents="none">
          {p.rings.map((r, i) => (
            <circle
              key={i}
              cx={center(r.center).x}
              cy={center(r.center).y}
              r={r.radius * TILE}
              fill="none"
              className={`ring ring-${r.kind}`}
            />
          ))}
        </g>
      )}
      {p.intents && <IntentLayer state={state} intents={p.intents} />}
      {p.tunnel && p.tunnel.length > 0 && (
        <g pointerEvents="none">
          {p.tunnel.map((q, i) => (
            <rect key={i} x={q.x * TILE + 9} y={q.y * TILE + 9} width={TILE - 18} height={TILE - 18} fill="none" stroke="#ff5d5d" strokeWidth={1.2} opacity={0.8} />
          ))}
        </g>
      )}
      <g pointerEvents="none">
        {state.husks
          .filter((h) => h.carriedBy === null)
          .map((h) => (
            <g key={h.id} transform={`translate(${center(h.pos).x},${center(h.pos).y})`}>
              <rect x={-7} y={-7} width={14} height={14} fill="#2a1c12" stroke="#ff8a2a" strokeWidth={1.5} strokeDasharray="3 2" />
              <text y={4} textAnchor="middle" fontSize={9} fontWeight={700} fill="#ff9d4d">
                H
              </text>
            </g>
          ))}
      </g>
      {p.scores && (
        <g pointerEvents="none">
          {(() => {
            const best = Math.max(...p.scores.map((s) => s.score));
            return p.scores.map((s, i) => (
              <text key={i} x={center(s.pos).x} y={center(s.pos).y + 3} textAnchor="middle" fontSize={8} fill={s.score === best ? '#ffe066' : '#ff8a2a'} opacity={s.score === best ? 1 : 0.75}>
                {s.score.toFixed(0)}
              </text>
            ));
          })()}
        </g>
      )}
      <g>
        {p.units.map((u) => (
          <UnitShape key={u.id} u={u} selected={u.id === p.selectedId} targeted={u.id === p.targetId} reveal={p.reveal} />
        ))}
      </g>
      <g pointerEvents="none">
        {p.fx.map((f) =>
          f.kind === 'shot' ? (
            <line
              key={f.id}
              x1={f.from.x * TILE + TILE / 2}
              y1={f.from.y * TILE + TILE / 2}
              x2={f.to.x * TILE + TILE / 2}
              y2={f.to.y * TILE + TILE / 2}
              stroke={f.side === 'drone' ? C.drone : C.invader}
              strokeWidth={f.hit ? 2.5 : 1.2}
              strokeDasharray={f.hit ? undefined : '3 3'}
              className="fx-shot"
            />
          ) : (
            <text key={f.id} x={f.at.x * TILE + TILE / 2} y={f.at.y * TILE} textAnchor="middle" className={`fx-float fx-${f.tone}`}>
              {f.text}
            </text>
          ),
        )}
      </g>
    </svg>
  );
}
