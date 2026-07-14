import { type Cell, type Level } from "./types";

export type GameState = {
  readonly level: Level;
  readonly path: Cell[];
  reset: () => void;
  extend: (cell: Cell) => boolean;
  isWin: () => boolean;
  isInPath: (cell: Cell) => boolean;
};

const sameCell = (a: Cell, b: Cell): boolean => a.r === b.r && a.c === b.c;

const isAdjacent = (a: Cell, b: Cell): boolean => {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
};

export function createGameState(level: Level): GameState {
  const path: Cell[] = [{ ...level.start }];

  const isInPath = (cell: Cell): boolean => path.some((item) => sameCell(item, cell));

  const reset = (): void => {
    path.splice(0, path.length, { ...level.start });
  };

  const extend = (cell: Cell): boolean => {
    if (cell.r < 0 || cell.r >= level.rows || cell.c < 0 || cell.c >= level.cols) {
      return false;
    }

    const head = path[path.length - 1];
    const previous = path[path.length - 2];

    if (previous && sameCell(cell, previous)) {
      path.pop();
      return true;
    }

    if (level.blocked[cell.r][cell.c] || isInPath(cell) || !isAdjacent(head, cell)) {
      return false;
    }

    path.push({ ...cell });
    return true;
  };

  const isWin = (): boolean => path.length === level.totalPlayable;

  return {
    level,
    path,
    reset,
    extend,
    isWin,
    isInPath,
  };
}
