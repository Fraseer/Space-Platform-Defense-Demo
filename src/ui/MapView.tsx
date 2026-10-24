// Top-down SVG grid. Placeholder shapes: cyan drones, orange invaders.
// The drawing pieces live in glyphs.tsx, shared with the map key.

import { memo } from 'react';
import { INVADERS, repairCost, type GameState, type Intent, type SystemObj, type TileScore, type Vec } from '../sim';
import {
  AirlockTile,
  BlipGlyph,
  CarryBadge,
  COLORS,
  DoorBar,
  DrillMark,
  FloorTile,
  FullCover,
  HalfCover,
  HpPips,
  HuskMark,
  KillCount,
  LINE,
  OverwatchArc,
  SalvageMark,
  SelectedRing,
  SystemTile,
  TargetReticle,
  TILE,
  UnitGlyph,
  UnseenRing,
  WallTile,
  floorFill,
} from './glyphs';
import { Icon, IconDefs } from './icons';
import type { DisplayUnit, Fx } from './useGame';

export { TILE };

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
                <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} {...LINE.intent} />
                <circle cx={end.x} cy={end.y} r={4} fill="none" stroke={COLORS.invader} strokeWidth={1.5} />
              </>
            )}
            {target && <line x1={end.x} y1={end.y} x2={center(target.pos).x} y2={center(target.pos).y} {...LINE.shotIntent} />}
            {sys && <Icon name="warning" x={center(sys.pos).x} y={center(sys.pos).y - 16} size={13} color={COLORS.danger} />}
          </g>
        );
      })}
    </g>
  );
}

const StaticTiles = memo(function StaticTiles({ state, sight }: { state: GameState; sight: (0 | 1 | 2)[] }) {
  const out: React.ReactNode[] = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const i = y * state.width + x;
      const t = state.tiles[i];
      const px = x * TILE;
      const py = y * TILE;
      if (t === 'wall') {
        out.push(<WallTile key={i} x={px} y={py} />);
        continue;
      }
      const v = sight[i];
      out.push(<FloorTile key={i} x={px} y={py} fill={floorFill(v, state.zones[state.zoneOf[i]]?.kind)} unseen={v === 0} />);
      if (t === 'half') out.push(<HalfCover key={`c${i}`} x={px} y={py} dim={v === 0} />);
      if (t === 'full') out.push(<FullCover key={`c${i}`} x={px} y={py} dim={v === 0} />);
    }
  }
  return <g>{out}</g>;
});

function Doors({ state }: { state: GameState }) {
  return (
    <g>
      {state.doors.map((d) => (
        <DoorBar
          key={`${d.pos.x},${d.pos.y}`}
          x={d.pos.x * TILE}
          y={d.pos.y * TILE}
          // Doors in a horizontal wall run (walls left and right) are drawn horizontally.
          horizontal={state.tiles[d.pos.y * state.width + d.pos.x - 1] === 'wall'}
          sealed={d.sealedRounds > 0}
        />
      ))}
    </g>
  );
}

function systemTitle(s: SystemObj): string {
  if (s.working) return `${s.name}: online`;
  const cost = repairCost(s.kind);
  return cost > 0 ? `${s.name}: offline. A Worker next to it can repair it for ${cost} matter.` : `${s.name}: offline`;
}

function Systems({ state }: { state: GameState }) {
  return (
    <g>
      {state.systems.map((s) => (
        <g key={s.id}>
          <title>{systemTitle(s)}</title>
          <SystemTile x={s.pos.x * TILE} y={s.pos.y * TILE} kind={s.kind} working={s.working} />
        </g>
      ))}
      {state.salvage
        .filter((sp) => sp.charges > 0)
        .map((sp) => (
          <g key={sp.id}>
            <title>{`Salvage: a Worker on or next to it gets matter (${sp.charges} left).`}</title>
            <SalvageMark x={sp.pos.x * TILE} y={sp.pos.y * TILE} />
          </g>
        ))}
      {state.airlocks.map((a) => (
        <g key={a.id}>
          <title>{a.name}</title>
          <AirlockTile x={a.pos.x * TILE} y={a.pos.y * TILE} letter={a.id} />
        </g>
      ))}
    </g>
  );
}

function UnitShape({ u, selected, targeted, reveal }: { u: DisplayUnit; selected: boolean; targeted: boolean; reveal: boolean }) {
  const transform = `translate(${u.pos.x * TILE + TILE / 2},${u.pos.y * TILE + TILE / 2})`;
  const style = { transition: 'transform 60ms linear' };
  if (!u.seen && !reveal) {
    return (
      <g transform={transform} style={style}>
        <BlipGlyph />
      </g>
    );
  }
  const color = u.side === 'drone' ? COLORS.drone : COLORS.invader;
  return (
    <g transform={transform} style={style}>
      {selected && <SelectedRing />}
      {!u.seen && <UnseenRing />}
      {targeted && <TargetReticle />}
      {u.overwatch && <OverwatchArc />}
      <UnitGlyph type={u.type} color={color} />
      <HpPips hp={u.hp} maxHp={u.maxHp} color={color} />
      {u.carrying && <CarryBadge />}
      {u.side === 'drone' && u.kills > 0 && <KillCount kills={u.kills} />}
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
      <IconDefs />
      <rect width={w} height={h} fill={COLORS.floorDark} />
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
          <polyline points={p.path.map((q) => `${q.x * TILE + TILE / 2},${q.y * TILE + TILE / 2}`).join(' ')} {...LINE.movePath} />
          {p.pathLabel && (
            <text
              x={p.path[p.path.length - 1].x * TILE + TILE / 2}
              y={p.path[p.path.length - 1].y * TILE - 3}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill={LINE.movePath.stroke}
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
            <DrillMark key={i} x={q.x * TILE} y={q.y * TILE} />
          ))}
        </g>
      )}
      <g>
        {state.husks
          .filter((h) => h.carriedBy === null)
          .map((h) => (
            <g key={h.id}>
              <title>{`${INVADERS[h.type].name} husk: a Worker can haul it to the fabricator for captured tech.`}</title>
              <HuskMark x={h.pos.x * TILE} y={h.pos.y * TILE} />
            </g>
          ))}
      </g>
      {p.scores && (
        <g pointerEvents="none">
          {(() => {
            const best = Math.max(...p.scores.map((s) => s.score));
            return p.scores.map((s, i) => (
              <text key={i} x={center(s.pos).x} y={center(s.pos).y + 3} textAnchor="middle" fontSize={8} fill={s.score === best ? '#ffe066' : COLORS.invader} opacity={s.score === best ? 1 : 0.75}>
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
              stroke={f.side === 'drone' ? COLORS.drone : COLORS.invader}
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
