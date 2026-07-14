export type Prng = {
  next: () => number;
  int: (maxExclusive: number) => number;
  shuffle: <T>(items: T[]) => T[];
};

export function createPrng(seed: number): Prng {
  let state = seed >>> 0;

  const next = (): number => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number): number => {
    if (maxExclusive <= 0) {
      return 0;
    }

    return Math.floor(next() * maxExclusive);
  };

  const shuffle = <T>(items: T[]): T[] => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = int(i + 1);
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }

    return result;
  };

  return { next, int, shuffle };
}
