import { createPrng, type Prng } from "./prng";
import { type Cell, type Level, MAX_LEVEL } from "./types";

type Difficulty = {
  rows: number;
  cols: number;
  holeRatio: number;
};

type RoutePlan = {
  path: Cell[];
  rows: number;
  cols: number;
};

const NEIGHBOR_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

const keyOf = (cell: Cell): string => `${cell.r},${cell.c}`;

const cellFromKey = (key: string): Cell => {
  const comma = key.indexOf(",");
  return { r: Number(key.slice(0, comma)), c: Number(key.slice(comma + 1)) };
};

const sameCell = (a: Cell, b: Cell): boolean => a.r === b.r && a.c === b.c;

const isAdjacent = (a: Cell, b: Cell): boolean => {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
};

function getDifficulty(levelId: number): Difficulty {
  const band = Math.floor((levelId - 1) / 10);
  const position = (levelId - 1) % 10;
  const baseRows = 3 + Math.min(6, Math.floor((levelId + 8) / 15));
  const baseCols = 4 + Math.min(7, Math.floor((levelId + 4) / 12));
  const rowSwing = [0, 1, 0, 2, -1, 1, 0, 2, -1, 1][position];
  const colSwing = [1, 0, 2, -1, 1, 2, 0, -1, 2, 1][position];
  const rows = Math.max(3, Math.min(10, baseRows + rowSwing));
  const cols = Math.max(4, Math.min(12, baseCols + colSwing));
  // Scattered empty cells ("holes"), spread out — not a thick blocked slab.
  const holeRatio = Math.min(0.26, 0.08 + band * 0.02 + (position % 3) * 0.02);

  return { rows, cols, holeRatio };
}

function buildSnakePath(rows: number, cols: number, variant: number): Cell[] {
  const transpose = variant % 2 === 1;
  const reverseRows = Math.floor(variant / 2) % 2 === 1;
  const reverseCols = Math.floor(variant / 4) % 2 === 1;
  const major = transpose ? cols : rows;
  const minor = transpose ? rows : cols;
  const path: Cell[] = [];

  for (let majorIndex = 0; majorIndex < major; majorIndex += 1) {
    const logicalMajor = reverseRows ? major - 1 - majorIndex : majorIndex;
    const leftToRight = majorIndex % 2 === 0;

    for (let minorStep = 0; minorStep < minor; minorStep += 1) {
      const logicalMinor = leftToRight ? minorStep : minor - 1 - minorStep;
      const adjustedMinor = reverseCols ? minor - 1 - logicalMinor : logicalMinor;
      path.push(
        transpose
          ? { r: adjustedMinor, c: logicalMajor }
          : { r: logicalMajor, c: adjustedMinor },
      );
    }
  }

  return path;
}

/**
 * Pick a spread-out set of "hole" cells (rendered as empty gaps).
 *
 * Two invariants make the leftover playable region likely to still admit a
 * Hamiltonian path (which `tracePath` then confirms):
 *  - **spread**: never two holes orthogonally adjacent (independent set) →
 *    gaps scatter instead of clumping into a slab.
 *  - **colour-balanced**: the grid is bipartite by (r+c)%2; a Hamiltonian
 *    path alternates colours, so |black-white| must stay ≤1. Removing an
 *    equal count per colour preserves that balance.
 */
function pickSpreadHoles(rows: number, cols: number, holeTarget: number, prng: Prng): Set<string> {
  const holes = new Set<string>();
  if (holeTarget <= 0) {
    return holes;
  }

  const cells = prng.shuffle(
    Array.from({ length: rows * cols }, (_, index) => ({
      r: Math.floor(index / cols),
      c: index % cols,
    })),
  );
  const perColor = [0, 0];
  const cap = Math.ceil(holeTarget / 2);

  const neighborHasHole = (cell: Cell): boolean =>
    NEIGHBOR_OFFSETS.some(([dr, dc]) => holes.has(`${cell.r + dr},${cell.c + dc}`));

  for (const cell of cells) {
    if (holes.size >= holeTarget) {
      break;
    }
    const color = (cell.r + cell.c) % 2;
    if (perColor[color] >= cap) {
      continue;
    }
    if (neighborHasHole(cell)) {
      continue;
    }
    holes.add(keyOf(cell));
    perColor[color] += 1;
  }

  return holes;
}

function isConnected(playable: Set<string>): boolean {
  if (playable.size === 0) {
    return false;
  }

  const startKey = playable.values().next().value as string;
  const seen = new Set<string>([startKey]);
  const stack: string[] = [startKey];

  while (stack.length > 0) {
    const cell = cellFromKey(stack.pop() as string);
    for (const [dr, dc] of NEIGHBOR_OFFSETS) {
      const nextKey = `${cell.r + dr},${cell.c + dc}`;
      if (playable.has(nextKey) && !seen.has(nextKey)) {
        seen.add(nextKey);
        stack.push(nextKey);
      }
    }
  }

  return seen.size === playable.size;
}

/**
 * Deterministic Hamiltonian-path search over the playable cells.
 *
 * Determinism (required for multiplayer seed sync across machines/browsers):
 *  - step BUDGET, not wall-clock time;
 *  - the Warnsdorff jitter is drawn ONCE per candidate and baked into its sort
 *    key, so `prng` advances a fixed, engine-independent number of times — a
 *    prng call inside a sort comparator would advance by an engine-dependent
 *    count (Array.sort comparison count varies) and desync the two players.
 *
 * Speed: cells are integer indices (`r*cols + c`) with a precomputed adjacency
 * list and a Uint8Array visited-mask — no per-step string hashing. Each start
 * cell gets its own budget so one bad start can't starve the real endpoints,
 * and starts are tried low-degree first (path endpoints are corners).
 */
function tracePath(
  rows: number,
  cols: number,
  playable: Set<string>,
  prng: Prng,
  perStartCap: number,
  maxStarts: number,
): Cell[] | null {
  const total = rows * cols;
  const isPlay = new Uint8Array(total);
  for (const key of playable) {
    const cell = cellFromKey(key);
    isPlay[cell.r * cols + cell.c] = 1;
  }

  const adjacency: number[][] = new Array(total);
  const indices: number[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c;
      if (!isPlay[i]) {
        continue;
      }
      indices.push(i);
      const neighbors: number[] = [];
      if (r > 0 && isPlay[i - cols]) neighbors.push(i - cols);
      if (r < rows - 1 && isPlay[i + cols]) neighbors.push(i + cols);
      if (c > 0 && isPlay[i - 1]) neighbors.push(i - 1);
      if (c < cols - 1 && isPlay[i + 1]) neighbors.push(i + 1);
      adjacency[i] = neighbors;
    }
  }

  const target = playable.size;
  const visited = new Uint8Array(total);
  const path: number[] = [];
  let steps = 0;

  const search = (cell: number): boolean => {
    if (steps >= perStartCap) {
      return false;
    }
    steps += 1;

    visited[cell] = 1;
    path.push(cell);

    if (path.length === target) {
      return true;
    }

    const candidates: { cell: number; key: number }[] = [];
    for (const next of adjacency[cell]) {
      if (visited[next]) {
        continue;
      }
      let onward = 0;
      for (const beyond of adjacency[next]) {
        if (!visited[beyond]) {
          onward += 1;
        }
      }
      // jitter baked in here, once — comparator stays pure (engine-stable)
      candidates.push({ cell: next, key: onward + (prng.next() - 0.5) * 0.7 });
    }
    candidates.sort((a, b) => a.key - b.key);

    for (const candidate of candidates) {
      if (search(candidate.cell)) {
        return true;
      }
    }

    visited[cell] = 0;
    path.pop();
    return false;
  };

  const starts = prng
    .shuffle(indices.slice())
    .map((i) => ({ i, degree: adjacency[i].length }))
    .sort((a, b) => a.degree - b.degree)
    .map((item) => item.i)
    .slice(0, maxStarts);

  for (const start of starts) {
    steps = 0;
    visited.fill(0);
    path.length = 0;
    if (search(start)) {
      return path.map((i) => ({ r: Math.floor(i / cols), c: i % cols }));
    }
  }

  return null;
}

function buildRoute(levelId: number, difficulty: Difficulty): RoutePlan {
  const { rows, cols } = difficulty;
  const prng = createPrng(levelId);
  const cellCount = rows * cols;
  const holeTarget = Math.min(
    Math.floor(cellCount * difficulty.holeRatio),
    Math.floor(cellCount * 0.34),
  );
  const minPlayable = Math.max(6, Math.ceil(cellCount * 0.5));

  // Try progressively sparser hole masks until one admits a Hamiltonian path.
  // Starting at the full target keeps boards irregular; shrinking on failure
  // guarantees we converge on a solvable, still-scattered layout.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = 1 - attempt * 0.12;
    const target = Math.max(0, Math.round(holeTarget * scale));
    const holes = pickSpreadHoles(rows, cols, target, prng);

    const playable = new Set<string>();
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const key = `${r},${c}`;
        if (!holes.has(key)) {
          playable.add(key);
        }
      }
    }

    if (playable.size < minPlayable || !isConnected(playable)) {
      continue;
    }

    const path = tracePath(rows, cols, playable, prng, 2500, 28);
    if (path && path.length === playable.size) {
      return { path, rows, cols };
    }
  }

  // Guaranteed-solvable fallback: a full boustrophedon snake (no holes).
  return { path: buildSnakePath(rows, cols, prng.int(8)), rows, cols };
}

function assertSolvable(level: Level, solutionPath: Cell[]): void {
  const seen = new Set<string>();

  for (let i = 0; i < solutionPath.length; i += 1) {
    const cell = solutionPath[i];
    const key = keyOf(cell);

    if (cell.r < 0 || cell.r >= level.rows || cell.c < 0 || cell.c >= level.cols) {
      throw new Error(`Level ${level.id} solution leaves grid`);
    }

    if (level.blocked[cell.r][cell.c]) {
      throw new Error(`Level ${level.id} solution crosses a wall`);
    }

    if (seen.has(key)) {
      throw new Error(`Level ${level.id} solution repeats a cell`);
    }

    if (i > 0 && !isAdjacent(solutionPath[i - 1], cell)) {
      throw new Error(`Level ${level.id} solution is not continuous`);
    }

    seen.add(key);
  }

  if (!sameCell(solutionPath[0], level.start) || solutionPath.length !== level.totalPlayable) {
    throw new Error(`Level ${level.id} solution does not cover playable cells`);
  }
}

const levelCache = new Map<number, Level>();

export function generateLevel(levelId: number): Level {
  const id = Math.min(MAX_LEVEL, Math.max(1, Math.floor(levelId)));
  const cached = levelCache.get(id);
  if (cached) {
    return cached;
  }

  const difficulty = getDifficulty(id);
  const route = buildRoute(id, difficulty);
  const playableKeys = new Set(route.path.map(keyOf));
  const blocked = Array.from({ length: route.rows }, (_, r) =>
    Array.from({ length: route.cols }, (_, c) => !playableKeys.has(`${r},${c}`)),
  );
  const level: Level = {
    id,
    rows: route.rows,
    cols: route.cols,
    blocked,
    start: route.path[0],
    totalPlayable: route.path.length,
  };

  assertSolvable(level, route.path);
  levelCache.set(id, level);
  return level;
}

export function assertAllLevelsSolvable(): void {
  for (let id = 1; id <= MAX_LEVEL; id += 1) {
    generateLevel(id);
  }

  console.info(`Puzzle Path: verified ${MAX_LEVEL} deterministic solvable levels`);
}
