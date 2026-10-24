// Seeded RNG (mulberry32). Its state lives in GameState.rng, so the same seed
// and the same commands always produce the same game.

export interface HasRng {
  rng: number;
}

/** Returns a float in [0, 1) and advances the state's RNG. */
export function rngNext(s: HasRng): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [0, n). */
export function rngInt(s: HasRng, n: number): number {
  return Math.floor(rngNext(s) * n);
}

/** Percentile roll: true with `chance`% probability. */
export function rngRoll(s: HasRng, chance: number): boolean {
  return rngNext(s) * 100 < chance;
}

export function rngShuffle<T>(s: HasRng, items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rngInt(s, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Turns any seed text into a 32-bit seed (FNV-1a). Numeric text is used as-is. */
export function seedFrom(text: string): number {
  if (/^\d+$/.test(text)) return Number(text) >>> 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
