// Every balance number in the demo lives here. Tune in playtesting; nothing
// else in src/ should hard-code a gameplay number.

export const CONFIG = {
  turn: {
    apPerTurn: 2,
    handSize: 5,
    /** true: unplayed cards stay in hand and you draw up to handSize. false: discard the hand each turn. */
    retainHand: true,
    /** AP a freshly fabricated drone gets on the turn it is built. */
    fabricatedAp: 1,
  },

  power: {
    baseIncome: 5,
    generatorBonus: 2,
    /** If upkeep exceeds income, the newest drones start the turn with this many AP. */
    brownoutAp: 1,
  },

  matter: {
    start: 6,
  },

  bridge: {
    integrity: 20,
  },

  combat: {
    minHit: 5,
    maxHit: 95,
    halfCover: 20,
    fullCover: 40,
    /** Cover on a side applies when the attacker's direction makes at least this cosine with that side. */
    coverMinDot: 0.3,
    flankDamageBonus: 1,
    /** A miss still deals this fraction of damage, rounded up. */
    grazeRatio: 0.5,
    rangeFalloffPerTile: 5,
    overwatchPenalty: 15,
    /** Invaders lose this much aim when they or their target stand in the dark. */
    invaderDarkPenalty: 25,
  },

  vision: {
    /** Invaders standing in the dark (or looking into it) only see this far. */
    invaderDarkVision: 3,
    /** How far invaders see into lit tiles. */
    invaderLitVision: 12,
  },

  drones: {
    sentry: { hp: 8, move: 4, aim: 75, damage: 4, optimalRange: 6, maxRange: 10, sensor: 5, upkeep: 1, matterCost: 8 },
    worker: { hp: 6, move: 5, aim: 55, damage: 2, optimalRange: 4, maxRange: 7, sensor: 4, upkeep: 1, matterCost: 5 },
  },

  invaders: {
    runner: { hp: 4, move: 5, aim: 55, damage: 2, optimalRange: 4, maxRange: 7, matterDrop: 2, override: 2 },
    brute: { hp: 12, move: 3, aim: 65, damage: 4, optimalRange: 4, maxRange: 7, matterDrop: 4, override: 1 },
    saboteur: { hp: 6, move: 4, aim: 60, damage: 3, optimalRange: 5, maxRange: 8, matterDrop: 3, override: 2 },
    breacher: { hp: 30, move: 0, aim: 60, damage: 5, optimalRange: 4, maxRange: 6, matterDrop: 0, override: 5 },
    rig: { hp: 14, move: 0, aim: 0, damage: 0, optimalRange: 0, maxRange: 0, matterDrop: 0, override: 0 },
  },

  worker: {
    salvageYield: 3,
    salvageCharges: 2,
    repairCost: { generator: 6, relay: 4 } as Record<string, number>,
    /** Movement lost while hauling a husk. */
    haulMovePenalty: 2,
  },

  ai: {
    /** Extra path cost the invaders' route planner gives a sealed door. */
    sealedDoorCost: 6,
    weights: {
      runner: { progress: 10, cover: 2, shot: 2, flank: 1, exposure: 1 },
      brute: { progress: 2, cover: 6, shot: 6, flank: 3, exposure: 3 },
      saboteur: { progress: 8, cover: 3, shot: 2, flank: 1, exposure: 2 },
    } as Record<string, { progress: number; cover: number; shot: number; flank: number; exposure: number }>,
    /** Score bonus for standing on a bridge tile (Runners override it). */
    bridgeBonus: 40,
    /** Score bonus for ending next to the system a Saboteur wants to break. */
    sabotageBonus: 40,
  },

  /** Act 1 script. Rounds are 1-based. `units` spawn at the airlock. */
  act1: {
    breaches: [
      { warnRound: 1, arriveRound: 4, units: ['runner', 'runner'] },
      { warnRound: 5, arriveRound: 8, units: ['brute', 'saboteur', 'runner'] },
      { warnRound: 9, arriveRound: 12, units: ['brute', 'brute', 'saboteur', 'runner', 'runner'] },
    ],
    boss: { warnRound: 13, arriveRound: 17, escorts: ['runner', 'runner'] },
  },

  boss: {
    /** Tunnel tiles the Siege Breacher advances per enemy turn. */
    drillSpeed: 2,
    /** Damage dealt to a drone standing in the drill's path. */
    drillCrush: 6,
  },

  cards: {
    fabricateSentry: { power: 2 },
    fabricateWorker: { power: 1 },
    overclock: { power: 1, ap: 1 },
    targetingUplink: { power: 1, aim: 30 },
    emergencyBulkhead: { power: 1, rounds: 3 },
    killTheLights: { power: 1, rounds: 2 },
    ventSection: { power: 3 },
    reroutePower: { power: 0, gain: 2 },
    recycle: { power: 0, refundRatio: 0.5 },
    scan: { power: 1, radius: 5 },
    disableShot: { power: 1 },
    fieldRepair: { power: 1, matter: 2, heal: 4 },
    /** Every captured-tech module card. */
    module: { power: 1 },
  },

  /** Starting deck: card id → copies. */
  startingDeck: {
    fabricateSentry: 1,
    fabricateWorker: 1,
    overclock: 2,
    targetingUplink: 2,
    emergencyBulkhead: 1,
    killTheLights: 1,
    ventSection: 1,
    reroutePower: 2,
    recycle: 1,
    scan: 1,
    disableShot: 0, // enabled with capture tech (milestone 6)
    fieldRepair: 1,
  } as Record<string, number>,

  modules: {
    servoLegs: { move: 2 },
    reflexLoop: {},
    featherweight: { upkeep: -1, hp: -2 },
    ablativePlating: { hp: 4 },
    hardenedShell: { damageReduction: 1 },
    siegeCannon: { damage: 2, move: -1 },
    signalJammer: { radius: 4, aimPenalty: 15 },
    opticSpike: { sensor: 3 },
    remoteUplink: {},
    plasmaCutter: {},
  } as Record<string, Partial<Record<'move' | 'upkeep' | 'hp' | 'damageReduction' | 'damage' | 'radius' | 'aimPenalty' | 'sensor', number>>>,
} as const;

export type Config = typeof CONFIG;
