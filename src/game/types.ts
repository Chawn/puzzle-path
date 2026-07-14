export type Cell = {
  r: number;
  c: number;
};

export type Level = {
  id: number;
  rows: number;
  cols: number;
  blocked: boolean[][];
  start: Cell;
  totalPlayable: number;
};

export type GameProgress = {
  currentLevel: number;
  unlockedLevel: number;
};

export const MAX_LEVEL = 100;
