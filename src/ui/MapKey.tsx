// The map key: every icon, shape, tile and overlay marker the map draws,
// using the same glyphs as the map so the two never drift apart.

import { useState, type ReactNode } from 'react';
import { CONFIG } from '../sim';
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
  WallTile,
  floorFill,
} from './glyphs';
import { Icon } from './icons';

type Tab = 'units' | 'map' | 'overlays';

interface Entry {
  label: string;
  title: string;
  draw: ReactNode;
}

const MID = TILE / 2;
const centred = (node: ReactNode) => <g transform={`translate(${MID},${MID})`}>{node}</g>;
const floor = <FloorTile x={0} y={0} fill={COLORS.floorLit} />;

const ENTRIES: Record<Tab, Entry[]> = {
  units: [
    { label: 'Sentry', title: 'Your combat drone: good aim, long range.', draw: centred(<UnitGlyph type="sentry" color={COLORS.drone} />) },
    { label: 'Worker', title: 'Your utility drone: repairs systems, salvages matter, hauls husks.', draw: centred(<UnitGlyph type="worker" color={COLORS.drone} />) },
    { label: 'Runner', title: 'Invader. Fast and fragile; beelines for the bridge.', draw: centred(<UnitGlyph type="runner" color={COLORS.invader} />) },
    { label: 'Brute', title: 'Invader. Tough; hunts drones it can see.', draw: centred(<UnitGlyph type="brute" color={COLORS.invader} />) },
    { label: 'Saboteur', title: 'Invader. Breaks systems you have repaired.', draw: centred(<UnitGlyph type="saboteur" color={COLORS.invader} />) },
    { label: 'Siege Breacher', title: 'Boss. Drills a tunnel straight at the bridge. Kill or disable it to win.', draw: centred(<UnitGlyph type="breacher" color={COLORS.invader} />) },
    { label: 'Drill Rig', title: "Boss anchor at the airlock it docked at. Destroy it to stop the drill and win.", draw: centred(<UnitGlyph type="rig" color={COLORS.invader} />) },
    { label: 'Unknown contact', title: 'Motion-tracker blip: an invader the ship cannot see. Light the room, get a drone sensor on it, or Scan.', draw: centred(<BlipGlyph />) },
    {
      label: 'Health pips',
      title: 'One pip per HP; dark pips are lost HP.',
      draw: centred(
        <>
          <UnitGlyph type="worker" color={COLORS.drone} />
          <HpPips hp={4} maxHp={6} color={COLORS.drone} />
        </>,
      ),
    },
    {
      label: 'Kill count',
      title: 'Kills this drone has made.',
      draw: centred(
        <>
          <UnitGlyph type="sentry" color={COLORS.drone} />
          <KillCount kills={3} />
        </>,
      ),
    },
    {
      label: 'On overwatch',
      title: 'Will fire once at the first invader that moves into its sight and range.',
      draw: centred(
        <>
          <OverwatchArc />
          <UnitGlyph type="sentry" color={COLORS.drone} />
        </>,
      ),
    },
    {
      label: 'Hauling a husk',
      title: 'A Worker carrying a husk to the fabricator (moves slower).',
      draw: centred(
        <>
          <UnitGlyph type="worker" color={COLORS.drone} />
          <CarryBadge />
        </>,
      ),
    },
    {
      label: 'Selected drone',
      title: 'The drone your clicks and actions apply to.',
      draw: centred(
        <>
          <SelectedRing />
          <UnitGlyph type="sentry" color={COLORS.drone} />
        </>,
      ),
    },
  ],
  map: [
    { label: 'AI core', title: 'You. The centre of the bridge.', draw: <SystemTile x={0} y={0} kind="core" working /> },
    { label: 'Fabricator', title: 'New drones appear next to it. Deliver husks here for captured tech.', draw: <SystemTile x={0} y={0} kind="fabricator" working /> },
    { label: 'Generator', title: 'Repaired: more power every turn.', draw: <SystemTile x={0} y={0} kind="generator" working /> },
    { label: 'Lighting relay', title: 'Repaired: lights its rooms, so the ship sees invaders there.', draw: <SystemTile x={0} y={0} kind="relay" working /> },
    { label: 'Broken system', title: 'Grey and dashed = offline. A Worker next to it can repair it for matter.', draw: <SystemTile x={0} y={0} kind="relay" working={false} /> },
    { label: 'Airlock', title: 'Where breaches arrive. The tag is its letter (A, B, C) as named in breach warnings.', draw: <AirlockTile x={0} y={0} letter="A" /> },
    {
      label: 'Salvage',
      title: 'A Worker on or next to it can salvage matter (limited uses).',
      draw: (
        <>
          {floor}
          <SalvageMark x={0} y={0} />
        </>
      ),
    },
    {
      label: 'Husk',
      title: 'A disabled invader. A Worker can haul it to the fabricator for a module card.',
      draw: (
        <>
          {floor}
          <HuskMark x={0} y={0} />
        </>
      ),
    },
    {
      label: 'Door',
      title: 'Open door: walk and see through it.',
      draw: (
        <>
          {floor}
          <DoorBar x={0} y={0} horizontal={false} sealed={false} />
        </>
      ),
    },
    {
      label: 'Sealed door',
      title: 'Emergency Bulkhead: blocks movement and sight for a few rounds. Counts as full cover.',
      draw: (
        <>
          {floor}
          <DoorBar x={0} y={0} horizontal={false} sealed />
        </>
      ),
    },
    {
      label: 'Half cover',
      title: `Crates and consoles: -${CONFIG.combat.halfCover}% to be hit from that side. Does not block sight.`,
      draw: (
        <>
          {floor}
          <HalfCover x={0} y={0} />
        </>
      ),
    },
    {
      label: 'Full cover',
      title: `Pillars and bulkheads: -${CONFIG.combat.fullCover}% to be hit from that side. Blocks sight.`,
      draw: (
        <>
          {floor}
          <FullCover x={0} y={0} />
        </>
      ),
    },
    { label: 'Wall', title: 'Blocks movement and sight; full cover for anyone beside it.', draw: <WallTile x={0} y={0} /> },
    { label: 'Lit floor', title: 'Lit by a relay: the ship sees everything here, but invaders aim normally.', draw: <FloorTile x={0} y={0} fill={floorFill(2, 'room')} /> },
    { label: 'Bridge', title: 'Invaders standing here drain bridge integrity. At 0 you lose.', draw: <FloorTile x={0} y={0} fill={floorFill(2, 'bridge')} /> },
    { label: 'Sensor coverage', title: 'Dark, but inside a drone sensor radius or a Scan: the ship sees invaders here.', draw: <FloorTile x={0} y={0} fill={floorFill(1, 'room')} /> },
    { label: 'Dark, unseen', title: 'The ship cannot see here; invaders show as blips. Invaders in the dark lose aim and vision.', draw: <FloorTile x={0} y={0} fill={floorFill(0, 'room')} unseen /> },
    { label: 'Drill tunnel', title: 'Rubble left by the Siege Breacher’s drill.', draw: <FloorTile x={0} y={0} fill={floorFill(2, 'tunnel')} /> },
  ],
  overlays: [
    { label: 'Move (1 AP)', title: 'Tiles the selected drone can reach for 1 AP.', draw: <rect x={1} y={1} width={TILE - 2} height={TILE - 2} className="hl hl-move1" /> },
    { label: 'Dash (2 AP)', title: 'Tiles reachable only with a 2 AP dash.', draw: <rect x={1} y={1} width={TILE - 2} height={TILE - 2} className="hl hl-move2" /> },
    { label: 'Planned move', title: 'The path the selected drone will take to the hovered tile.', draw: <polyline points={`3,${TILE - 4} ${MID},${TILE - 4} ${MID},4 ${TILE - 3},4`} {...LINE.movePath} /> },
    {
      label: 'Has a shot',
      title: 'An invader the selected drone can shoot. Click to see the hit chance.',
      draw: (
        <>
          <rect x={1} y={1} width={TILE - 2} height={TILE - 2} className="hl hl-target" />
          {centred(<UnitGlyph type="runner" color={COLORS.invader} />)}
        </>
      ),
    },
    {
      label: 'Locked target',
      title: 'Click again or press F to fire.',
      draw: centred(
        <>
          <TargetReticle />
          <UnitGlyph type="runner" color={COLORS.invader} />
        </>,
      ),
    },
    { label: 'Card target', title: 'A valid target for the card you are playing.', draw: <rect x={1} y={1} width={TILE - 2} height={TILE - 2} className="hl hl-cardTarget" /> },
    {
      label: 'Enemy will move',
      title: 'Tactical overlay: where a visible invader will move this enemy turn.',
      draw: (
        <>
          <polyline points={`3,${TILE - 4} ${TILE - 6},6`} {...LINE.intent} />
          <circle cx={TILE - 6} cy={6} r={4} fill="none" stroke={COLORS.invader} strokeWidth={1.5} />
        </>
      ),
    },
    { label: 'Enemy will shoot', title: 'Tactical overlay: which drone a visible invader will shoot.', draw: <line x1={3} y1={TILE - 4} x2={TILE - 3} y2={4} {...LINE.shotIntent} /> },
    { label: 'Will sabotage', title: 'Tactical overlay: a system an invader is about to break.', draw: <Icon name="warning" x={MID} y={MID} size={22} color={COLORS.danger} /> },
    {
      label: 'Drill route',
      title: 'Tiles the Siege Breacher will drill through on its way to the bridge. Always shown.',
      draw: (
        <>
          <WallTile x={0} y={0} />
          <DrillMark x={0} y={0} />
        </>
      ),
    },
    { label: 'Optimal range', title: 'Selected drone: no range penalty inside this ring.', draw: <circle cx={MID} cy={MID} r={12} fill="none" className="ring ring-optimal" /> },
    { label: 'Max range', title: `Selected drone: cannot shoot beyond this ring; -${CONFIG.combat.rangeFalloffPerTile}% per tile past optimal.`, draw: <circle cx={MID} cy={MID} r={12} fill="none" className="ring ring-max" /> },
    { label: 'Sensor range', title: 'Selected drone: sees invaders in the dark inside this ring (with line of sight).', draw: <circle cx={MID} cy={MID} r={12} fill="none" className="ring ring-sensor" /> },
    { label: 'Overwatch range', title: 'Tactical overlay: reach of other drones on overwatch.', draw: <circle cx={MID} cy={MID} r={12} fill="none" className="ring ring-overwatch" /> },
    {
      label: 'AI score (debug)',
      title: 'Debug overlay: how the hovered invader rates each tile it could reach. Yellow = its pick.',
      draw: (
        <text x={MID} y={MID + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#ffe066">
          12
        </text>
      ),
    },
  ],
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'units', label: 'Units' },
  { id: 'map', label: 'Map' },
  { id: 'overlays', label: 'Overlays' },
];

const TAB_STORAGE = 'spd.keyTab';

function readTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_STORAGE);
    if (t === 'units' || t === 'map' || t === 'overlays') return t;
  } catch {
    // storage unavailable: use the default
  }
  return 'units';
}

export function MapKey() {
  const [tab, setTab] = useState<Tab>(readTab);
  const choose = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_STORAGE, t);
    } catch {
      // not persisted, fine
    }
  };
  return (
    <div className="key">
      <div className="key-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => choose(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="key-grid">
        {ENTRIES[tab].map((e) => (
          <div key={e.label} className="key-item" title={e.title}>
            <svg className="key-swatch" viewBox={`-3 -3 ${TILE + 6} ${TILE + 6}`} width={26} height={26} aria-hidden>
              {e.draw}
            </svg>
            <span>{e.label}</span>
          </div>
        ))}
      </div>
      <div className="muted small">Hover an entry for details.</div>
    </div>
  );
}
