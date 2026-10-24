// Core data types for the simulation. GameState is plain, serialisable data:
// no classes, no functions, no Maps — so it can be cloned, saved and replayed.

export interface Vec {
  x: number;
  y: number;
}

export type TileKind = 'wall' | 'floor' | 'door' | 'half' | 'full' | 'system' | 'airlock';

export type DroneType = 'sentry' | 'worker';
export type InvaderType = 'runner' | 'brute' | 'saboteur' | 'breacher' | 'rig';
export type UnitType = DroneType | InvaderType;
export type Side = 'drone' | 'invader';

export interface Unit {
  id: number;
  side: Side;
  type: UnitType;
  /** Serial name for drones, type name for invaders. */
  name: string;
  pos: Vec;
  hp: number;
  maxHp: number;
  ap: number;
  /** Took any action this turn (drones that didn't go on overwatch automatically). */
  acted: boolean;
  overwatch: boolean;
  kills: number;
  /** Bonus aim on the next shot (Targeting Uplink). */
  aimBonus: number;
  /** Next lethal shot leaves a husk (Disable Shot). */
  disableNext: boolean;
  modules: string[];
  /** Husk id this Worker is hauling. */
  carrying: number | null;
  /** Order of creation, used to pick which drones brown out first. */
  serial: number;
}

export type ZoneKind = 'room' | 'corridor' | 'bridge' | 'tunnel';

export interface Zone {
  id: string;
  name: string;
  kind: ZoneKind;
  alwaysLit: boolean;
  /** Rounds left of forced darkness (Kill the Lights). */
  darkRounds: number;
}

export interface Door {
  pos: Vec;
  sealedRounds: number;
}

export type SystemKind = 'fabricator' | 'generator' | 'relay' | 'core';

export interface SystemObj {
  id: number;
  kind: SystemKind;
  name: string;
  pos: Vec;
  working: boolean;
  /** Repaired by a Worker during this run (Saboteurs hunt these). */
  repaired: boolean;
  /** Zone indices this relay lights while working. */
  lights: number[];
}

export interface SalvageSpot {
  id: number;
  pos: Vec;
  charges: number;
}

export interface Husk {
  id: number;
  type: InvaderType;
  pos: Vec;
  carriedBy: number | null;
}

export interface Airlock {
  id: string;
  name: string;
  pos: Vec;
}

export interface CardInstance {
  uid: number;
  cardId: string;
}

export interface Deck {
  draw: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  exhausted: CardInstance[];
}

export interface Breach {
  index: number;
  airlock: string;
  warnRound: number;
  arriveRound: number;
  units: InvaderType[];
  announced: boolean;
  arrived: boolean;
  boss: boolean;
}

export interface Scan {
  center: Vec;
  radius: number;
}

export interface BossState {
  breacherId: number;
  rigId: number;
  /** Planned tunnel, from the dock to the bridge. */
  tunnel: Vec[];
  /** Index of the next tunnel tile to drill or enter. */
  progress: number;
}

export interface ModuleChoice {
  from: InvaderType;
  options: string[];
}

export interface Stats {
  kills: number;
  dronesLost: number;
  dronesBuilt: number;
  husksCaptured: number;
  matterGained: number;
  cardsPlayed: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  seed: number;
  rng: number;
  round: number;
  status: GameStatus;
  outcome: string;
  width: number;
  height: number;
  tiles: TileKind[];
  /** Zone index per tile, -1 for walls, doors and airlocks. */
  zoneOf: number[];
  zones: Zone[];
  doors: Door[];
  systems: SystemObj[];
  salvage: SalvageSpot[];
  airlocks: Airlock[];
  bridgeTiles: number[];
  units: Unit[];
  husks: Husk[];
  nextId: number;
  power: number;
  matter: number;
  deck: Deck;
  bridge: { integrity: number; max: number };
  breaches: Breach[];
  boss: BossState | null;
  scans: Scan[];
  pendingChoice: ModuleChoice | null;
  stats: Stats;
}

// ---------------------------------------------------------------------------
// Commands: everything the player can do. Validated, then applied.

export type CardTarget =
  | { kind: 'none' }
  | { kind: 'unit'; unitId: number }
  | { kind: 'door'; pos: Vec }
  | { kind: 'zone'; zone: number }
  | { kind: 'tile'; pos: Vec };

export type Command =
  | { type: 'move'; unitId: number; to: Vec }
  | { type: 'shoot'; unitId: number; targetId: number }
  | { type: 'overwatch'; unitId: number }
  | { type: 'repair'; unitId: number; systemId: number }
  | { type: 'salvage'; unitId: number; spotId: number }
  | { type: 'pickUp'; unitId: number; huskId: number }
  | { type: 'drop'; unitId: number }
  | { type: 'playCard'; uid: number; target: CardTarget }
  | { type: 'chooseModule'; index: number }
  | { type: 'endTurn' };

// ---------------------------------------------------------------------------
// Events: what happened, in order. The UI animates these; it never infers.

export interface ShotInfo {
  chance: number;
  hit: boolean;
  damage: number;
  flanked: boolean;
  overwatch: boolean;
}

export type GameEvent =
  | { type: 'roundStarted'; round: number }
  | { type: 'enemyPhase' }
  /** `seen[i]` says whether the ship could see the unit after step i (invaders only). */
  | { type: 'unitMoved'; unitId: number; path: Vec[]; seen?: boolean[] }
  | { type: 'shot'; shooterId: number; targetId: number; from: Vec; to: Vec; info: ShotInfo; shooterSeen: boolean }
  | { type: 'damaged'; unitId: number; amount: number; hp: number }
  | { type: 'killed'; unitId: number; byId: number | null; cause: 'shot' | 'vent' | 'drill' | 'recycle' }
  | { type: 'disabled'; unitId: number; huskId: number }
  | { type: 'unitSpawned'; unit: Unit; seen: boolean }
  | { type: 'overwatchSet'; unitId: number; auto?: boolean }
  | { type: 'apGained'; unitId: number; amount: number }
  | { type: 'healed'; unitId: number; amount: number }
  | { type: 'cardPlayed'; cardId: string; uid: number }
  | { type: 'cardsDrawn'; count: number }
  | { type: 'powerChanged'; power: number; reason: string }
  | { type: 'matterChanged'; matter: number; delta: number; reason: string }
  | { type: 'brownout'; unitIds: number[] }
  | { type: 'doorSealed'; pos: Vec; rounds: number }
  | { type: 'doorUnsealed'; pos: Vec }
  | { type: 'zoneDarkened'; zone: number; rounds: number }
  | { type: 'zoneVented'; zone: number }
  | { type: 'scanned'; center: Vec; radius: number }
  | { type: 'systemRepaired'; systemId: number }
  | { type: 'systemSabotaged'; systemId: number; byId: number; seen: boolean }
  | { type: 'salvaged'; unitId: number; spotId: number; amount: number }
  | { type: 'huskPickedUp'; unitId: number; huskId: number }
  | { type: 'huskDropped'; huskId: number; pos: Vec }
  | { type: 'huskDelivered'; huskId: number; from: InvaderType }
  | { type: 'moduleChosen'; moduleId: string }
  | { type: 'moduleInstalled'; unitId: number; moduleId: string }
  | { type: 'breachWarning'; airlock: string; inRounds: number; boss: boolean }
  | { type: 'breach'; airlock: string; boss: boolean }
  | { type: 'bridgeDamaged'; amount: number; integrity: number }
  | { type: 'drilled'; tiles: Vec[] }
  | { type: 'log'; text: string; tone?: 'info' | 'warn' | 'good' | 'bad' }
  | { type: 'gameOver'; status: GameStatus; outcome: string };

export interface CommandResult {
  ok: boolean;
  error?: string;
  state: GameState;
  events: GameEvent[];
}
