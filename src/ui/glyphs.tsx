// Drawing pieces shared by the map and its key, so the key always matches
// what the map shows. Tile glyphs take the tile's top-left corner (x, y) in
// map pixels; unit glyphs draw centred on (0, 0) for the caller to translate.

import type { SystemKind, UnitType, ZoneKind } from '../sim';
import { Icon, type IconName } from './icons';

export const TILE = 28;

export const COLORS = {
  floorLit: '#1b242e',
  floorBridge: '#1c2b36',
  floorSensed: '#0e171c',
  floorDark: '#07090c',
  tunnelLit: '#2a1b10',
  tunnelDark: '#140d08',
  wall: '#36404c',
  door: '#4b5866',
  sealed: '#d94a4a',
  half: '#3c4652',
  full: '#56606c',
  drone: '#3fe0ff',
  invader: '#ff8a2a',
  salvage: '#c8b26a',
  working: '#7fe7c4',
  broken: '#6b6f75',
  danger: '#ff5d5d',
  marker: '#e8fbff',
};

/** Overlay line styles (map and key use the same ones). */
export const LINE = {
  movePath: { stroke: '#bff6ff', strokeWidth: 2, strokeDasharray: '5 4', fill: 'none' },
  intent: { stroke: COLORS.invader, strokeWidth: 1.6, strokeDasharray: '4 3', fill: 'none', opacity: 0.85 },
  shotIntent: { stroke: COLORS.danger, strokeWidth: 1.4, strokeDasharray: '2 3' },
} as const;

/** sight: 2 lit, 1 seen by sensors or a scan only, 0 unseen. */
export function floorFill(sight: 0 | 1 | 2, zone: ZoneKind | undefined): string {
  if (zone === 'tunnel') return sight === 0 ? COLORS.tunnelDark : COLORS.tunnelLit;
  if (sight === 2) return zone === 'bridge' ? COLORS.floorBridge : COLORS.floorLit;
  return sight === 1 ? COLORS.floorSensed : COLORS.floorDark;
}

type At = { x: number; y: number };

export function FloorTile({ x, y, fill, unseen = false }: At & { fill: string; unseen?: boolean }) {
  return <rect x={x} y={y} width={TILE} height={TILE} fill={fill} stroke={unseen ? '#0b0e12' : '#0c1015'} strokeWidth={0.5} />;
}

export function WallTile({ x, y }: At) {
  return <rect x={x} y={y} width={TILE} height={TILE} fill={COLORS.wall} stroke={COLORS.wall} strokeWidth={0.5} />;
}

export function HalfCover({ x, y, dim = false }: At & { dim?: boolean }) {
  return <rect x={x + 5} y={y + 9} width={TILE - 10} height={TILE - 18} rx={2} fill={COLORS.half} opacity={dim ? 0.45 : 1} />;
}

export function FullCover({ x, y, dim = false }: At & { dim?: boolean }) {
  return <rect x={x + 4} y={y + 4} width={TILE - 8} height={TILE - 8} rx={2} fill={COLORS.full} opacity={dim ? 0.45 : 1} />;
}

/** A door is a bar across its tile, along the wall it sits in. */
export function DoorBar({ x, y, horizontal, sealed }: At & { horizontal: boolean; sealed: boolean }) {
  const fill = sealed ? COLORS.sealed : COLORS.door;
  const opacity = sealed ? 1 : 0.8;
  return horizontal ? (
    <rect x={x} y={y + TILE / 2 - 2} width={TILE} height={4} fill={fill} opacity={opacity} />
  ) : (
    <rect x={x + TILE / 2 - 2} y={y} width={4} height={TILE} fill={fill} opacity={opacity} />
  );
}

export function SystemTile({ x, y, kind, working }: At & { kind: SystemKind; working: boolean }) {
  const color = working ? COLORS.working : COLORS.broken;
  return (
    <>
      <rect x={x + 2} y={y + 2} width={TILE - 4} height={TILE - 4} rx={4} fill="#1d262f" stroke={color} strokeWidth={1.5} strokeDasharray={working ? undefined : '3 2'} />
      <Icon name={kind as IconName} x={x + TILE / 2} y={y + TILE / 2} size={18} color={color} />
    </>
  );
}

export function SalvageMark({ x, y }: At) {
  return (
    <>
      <circle cx={x + TILE / 2} cy={y + TILE / 2} r={5} fill="none" stroke={COLORS.salvage} strokeWidth={1.5} />
      <circle cx={x + TILE / 2} cy={y + TILE / 2} r={1.8} fill={COLORS.salvage} />
    </>
  );
}

export function AirlockTile({ x, y, letter }: At & { letter: string }) {
  return (
    <>
      <rect x={x + 1} y={y + 1} width={TILE - 2} height={TILE - 2} fill="#2a1c12" stroke="#a8571c" strokeWidth={1.5} />
      <Icon name="airlock" x={x + TILE / 2} y={y + TILE / 2} size={20} color="#ff9d4d" />
      {/* The airlock's letter stays as a small tag: breach warnings name airlocks by it. */}
      <rect x={x + TILE - 10} y={y + TILE - 10} width={9} height={9} rx={1.5} fill="#2a1c12" stroke="#a8571c" strokeWidth={0.8} />
      <text x={x + TILE - 5.5} y={y + TILE - 2.8} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#ffb877">
        {letter}
      </text>
    </>
  );
}

export function HuskMark({ x, y }: At) {
  return (
    <>
      <circle cx={x + TILE / 2} cy={y + TILE / 2} r={10} fill="#2a1c12" stroke="#a8571c" strokeWidth={1} strokeDasharray="3 2" />
      <Icon name="husk" x={x + TILE / 2} y={y + TILE / 2} size={16} color="#ff9d4d" />
    </>
  );
}

/** A tile the boss drill has yet to cut. */
export function DrillMark({ x, y }: At) {
  return <rect x={x + 9} y={y + 9} width={TILE - 18} height={TILE - 18} fill="none" stroke={COLORS.danger} strokeWidth={1.2} opacity={0.8} />;
}

// ---------------------------------------------------------------------------
// Units and their markers, centred on (0, 0).

export function UnitGlyph({ type, color }: { type: UnitType; color: string }) {
  switch (type) {
    case 'sentry':
      return <polygon points="0,-10 10,0 0,10 -10,0" fill={color} />;
    case 'worker':
      return <circle r={8} fill={color} />;
    case 'runner':
      return <polygon points="0,-9 8,7 -8,7" fill={color} />;
    case 'brute':
      return <rect x={-10} y={-10} width={20} height={20} rx={2} fill={color} />;
    case 'saboteur':
      return <polygon points="-5,-9 5,-9 10,0 5,9 -5,9 -10,0" fill={color} />;
    case 'breacher':
      return <polygon points="-6,-12 6,-12 12,-6 12,6 6,12 -6,12 -12,6 -12,-6" fill={color} stroke="#ffd2a6" strokeWidth={1.5} />;
    case 'rig':
      return (
        <g>
          <rect x={-11} y={-11} width={22} height={22} fill="none" stroke={color} strokeWidth={3} />
          <path d="M-8,-8 L8,8 M8,-8 L-8,8" stroke={color} strokeWidth={3} />
        </g>
      );
  }
}

/** An invader the ship can't see: position only. */
export function BlipGlyph() {
  return (
    <>
      <circle r={9} className="blip-pulse" />
      <circle r={3} fill={COLORS.invader} />
    </>
  );
}

export function SelectedRing() {
  return <circle r={13} fill="none" stroke={COLORS.marker} strokeWidth={1.5} strokeDasharray="4 3" />;
}

export function TargetReticle() {
  return (
    <g stroke={COLORS.danger} strokeWidth={1.8}>
      <circle r={13} fill="none" />
      <path d="M0,-17 L0,-11 M0,11 L0,17 M-17,0 L-11,0 M11,0 L17,0" />
    </g>
  );
}

export function OverwatchArc() {
  return <path d="M-11,9 Q0,15 11,9" fill="none" stroke={COLORS.marker} strokeWidth={1.6} />;
}

/** Debug reveal: an invader the ship can't actually see. */
export function UnseenRing() {
  return <circle r={14} fill="none" stroke={COLORS.invader} strokeWidth={0.8} strokeDasharray="1 2" />;
}

export function CarryBadge() {
  return (
    <g>
      <circle cx={-9} cy={8} r={5.5} fill="#2a1c12" stroke={COLORS.invader} strokeWidth={1} />
      <Icon name="husk" x={-9} y={8} size={9} color="#ff9d4d" />
    </g>
  );
}

export function HpPips({ hp, maxHp, color }: { hp: number; maxHp: number; color: string }) {
  const w = Math.min(4, 22 / maxHp);
  return (
    <g>
      {Array.from({ length: maxHp }, (_, i) => (
        <rect key={i} x={-11 + i * w} y={-15} width={Math.max(w - 0.6, 0.8)} height={2.5} fill={i < hp ? color : '#333a42'} />
      ))}
    </g>
  );
}

export function KillCount({ kills }: { kills: number }) {
  return (
    <text x={10} y={13} fontSize={8} fontWeight={700} fill={COLORS.marker}>
      {kills}
    </text>
  );
}
