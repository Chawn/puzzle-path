import { createPrng, type Prng } from "./prng";
import { type Cell, type Level, MAX_LEVEL } from "./types";

type Difficulty = {
  rows: number;
  cols: number;
  walls: number;
};

type RoutePlan = {
  path: Cell[];
  rows: number;
  cols: number;
};

const keyOf = (cell: Cell): string => `${cell.r},${cell.c}`;

const sameCell = (a: Cell, b: Cell): boolean => a.r === b.r && a.c === b.c;

const isAdjacent = (a: Cell, b: Cell): boolean => {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
};

function getDifficulty(levelId: number): Difficulty {
  if (levelId <= 10) {
    const size = levelId <= 5 ? 3 : 4;
    return { rows: size, cols: size, walls: 0 };
  }

  if (levelId <= 30) {
    return { rows: 5, cols: 5, walls: Math.floor((levelId - 11) / 7) + 1 };
  }

  if (levelId <= 60) {
    return { rows: 6, cols: 6, walls: 4 + Math.floor((levelId - 31) / 6) };
  }

  if (levelId <= 90) {
    return { rows: 7, cols: 7, walls: 8 + Math.floor((levelId - 61) / 5) };
  }

  return { rows: 8, cols: 8, walls: 15 + Math.floor((levelId - 91) / 2) };
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

function tryRandomPath(rows: number, cols: number, targetLength: number, prng: Prng): Cell[] | null {
  const starts = prng.shuffle(
    Array.from({ length: rows * cols }, (_, index) => ({
      r: Math.floor(index / cols),
      c: index % cols,
    })),
  );
  const deadline = performance.now() + 12;
  const visited = new Set<string>();
  const path: Cell[] = [];

  const neighborsOf = (cell: Cell): Cell[] => {
    const options = [
      { r: cell.r - 1, c: cell.c },
      { r: cell.r + 1, c: cell.c },
      { r: cell.r, c: cell.c - 1 },
      { r: cell.r, c: cell.c + 1 },
    ].filter((next) => next.r >= 0 && next.r < rows && next.c >= 0 && next.c < cols);

    return prng.shuffle(options);
  };

  const search = (cell: Cell): boolean => {
    if (performance.now() > deadline) {
      return false;
    }

    path.push(cell);
    visited.add(keyOf(cell));

    if (path.length === targetLength) {
      return true;
    }

    for (const next of neighborsOf(cell)) {
      if (!visited.has(keyOf(next)) && search(next)) {
        return true;
      }
    }

    visited.delete(keyOf(cell));
    path.pop();
    return false;
  };

  for (const start of starts) {
    visited.clear();
    path.length = 0;
    if (search(start)) {
      return [...path];
    }
  }

  return null;
}

function buildRoute(levelId: number, difficulty: Difficulty): RoutePlan {
  const prng = createPrng(levelId);
  const targetLength = difficulty.rows * difficulty.cols - difficulty.walls;
  const randomized = tryRandomPath(difficulty.rows, difficulty.cols, targetLength, prng);

  if (randomized) {
    return { path: randomized, rows: difficulty.rows, cols: difficulty.cols };
  }

  const fullPath = buildSnakePath(difficulty.rows, difficulty.cols, prng.int(8));
  const startOffset = prng.int(fullPath.length);
  const rotated = [...fullPath.slice(startOffset), ...fullPath.slice(0, startOffset)];
  const contiguous = rotated.slice(0, targetLength);

  if (!contiguous.every((cell, index) => index === 0 || isAdjacent(cell, contiguous[index - 1]))) {
    return { path: fullPath.slice(0, targetLength), rows: difficulty.rows, cols: difficulty.cols };
  }

  return { path: contiguous, rows: difficulty.rows, cols: difficulty.cols };
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

export function generateLevel(levelId: number): Level {
  const id = Math.min(MAX_LEVEL, Math.max(1, Math.floor(levelId)));
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
  return level;
}

export function assertAllLevelsSolvable(): void {
  for (let id = 1; id <= MAX_LEVEL; id += 1) {
    generateLevel(id);
  }

  console.info(`Puzzle Path: verified ${MAX_LEVEL} deterministic solvable levels`);
}
