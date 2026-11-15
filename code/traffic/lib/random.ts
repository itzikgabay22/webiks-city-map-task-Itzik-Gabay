import exec from 'k6/execution';

/** mulberry32: small deterministic PRNG. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_SEED = Number(__ENV.SEED || 20261030);

/** Deterministic random source for the current scenario iteration. */
export function iterationRandom(): () => number {
  const name = exec.scenario.name;
  let h = BASE_SEED;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 2654435761);
  return prng(h ^ Math.imul(exec.scenario.iterationInTest + 1, 40503));
}

export function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

export function between(random: () => number, min: number, max: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round((min + random() * (max - min)) * f) / f;
}
