// Public surface of the simulation for the UI.

export * from './types';
export { CONFIG } from './config';
export { applyCommand } from './reducer';
export { validateCommand } from './validate';
export { newGame, wakeUpEvents } from './setup';
export { seedFrom } from './rng';
export { moveOptions, planMove } from './pathfinding';
export { stats, unitById, drones, invaders } from './units';
export { idx, posOf, samePos } from './grid';
export { powerIncome, totalUpkeep } from './economy';
export { describeEvent } from './describe';
export { COMMAND_DECK } from './content/map';
export { DRONES, INVADERS } from './content/units';
export { canTarget, previewShot, coverAgainst, type ShotPreview } from './combat';
export { droneCan } from './validate';
export { CARDS, type CardDef, type TargetKind } from './content/cards';
export { cardError, fabricatorSpawnTile, zoneTiles } from './effects';
export { repairCost, withinReach } from './actions';
