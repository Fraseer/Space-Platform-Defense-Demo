// `npm run balance`: plays the greedy bot over many seeds and prints win rate
// and run length. Use it after changing src/sim/config.ts.

import { it } from 'vitest';
import { newGame } from '../src/sim/setup';
import { botTurn } from './bot';

const SEEDS = 40;

it('balance report', () => {
  const rows: string[] = [];
  let wins = 0;
  let rounds = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    let s = newGame(seed);
    while (s.status === 'playing' && s.round < 60) s = botTurn(s);
    if (s.status === 'won') wins++;
    rounds += s.round;
    rows.push(
      `seed ${String(seed).padStart(3)}  ${s.status.padEnd(7)} round ${String(s.round).padStart(2)}  bridge ${String(s.bridge.integrity).padStart(2)}/${s.bridge.max}` +
        `  built ${s.stats.dronesBuilt} lost ${s.stats.dronesLost} kills ${s.stats.kills}  ${s.outcome}`,
    );
  }
  rows.push(`\nBot win rate ${wins}/${SEEDS} (${Math.round((wins / SEEDS) * 100)}%), average ${(rounds / SEEDS).toFixed(1)} rounds.`);
  console.log(rows.join('\n'));
}, 600_000);
