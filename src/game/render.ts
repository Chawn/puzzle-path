import { type GameState } from "./state";
import { type Cell, MAX_LEVEL } from "./types";
import { gameAudio } from "./audio";

export type RenderHandles = {
  grid: HTMLElement;
  backButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
  setWon: (isWon: boolean) => void;
  update: () => void;
};

const sameCell = (a: Cell, b: Cell): boolean => a.r === b.r && a.c === b.c;

const keyOf = (cell: Cell): string => `${cell.r},${cell.c}`;

function directionClass(from: Cell, to: Cell): string {
  if (to.r < from.r) {
    return "connect-up";
  }
  if (to.r > from.r) {
    return "connect-down";
  }
  if (to.c < from.c) {
    return "connect-left";
  }
  return "connect-right";
}

export function renderGame(app: HTMLElement, state: GameState): RenderHandles {
  app.innerHTML = "";

  const shell = document.createElement("main");
  shell.className = "game-shell";

  const topbar = document.createElement("header");
  topbar.className = "topbar";

  const title = document.createElement("div");
  title.className = "level-title";
  title.textContent = `ด่าน ${state.level.id}/${MAX_LEVEL}`;

  const controls = document.createElement("div");
  controls.className = "topbar-controls";

  const muteButton = gameAudio.createMuteButton();

  const backButton = document.createElement("button");
  backButton.className = "control-button subtle-button";
  backButton.type = "button";
  backButton.textContent = "เลือกด่าน";

  const resetButton = document.createElement("button");
  resetButton.className = "control-button";
  resetButton.type = "button";
  resetButton.textContent = "Reset";

  controls.append(muteButton, backButton, resetButton);
  topbar.append(title, controls);

  const gridWrap = document.createElement("section");
  gridWrap.className = "grid-wrap";

  const grid = document.createElement("div");
  grid.className = "grid";
  grid.style.setProperty("--rows", String(state.level.rows));
  grid.style.setProperty("--cols", String(state.level.cols));

  for (let r = 0; r < state.level.rows; r += 1) {
    for (let c = 0; c < state.level.cols; c += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      const label = document.createElement("span");
      label.className = "cell-label";
      const particles = document.createElement("span");
      particles.className = "cell-particles";
      cell.append(label, particles);
      grid.append(cell);
    }
  }

  gridWrap.append(grid);

  const overlay = document.createElement("div");
  overlay.className = "win-overlay";
  overlay.hidden = true;

  const dialog = document.createElement("div");
  dialog.className = "win-dialog";

  const message = document.createElement("strong");
  message.textContent = "ผ่าน!";

  const nextButton = document.createElement("button");
  nextButton.className = "primary-button";
  nextButton.type = "button";
  nextButton.textContent = "ด่านต่อไป";

  dialog.append(message, nextButton);
  overlay.append(dialog);
  shell.append(topbar, gridWrap, overlay);
  app.append(shell);

  const update = (): void => {
    const pathIndex = new Map<string, number>();
    state.path.forEach((cell, index) => pathIndex.set(keyOf(cell), index));

    for (const child of Array.from(grid.children)) {
      const cellEl = child as HTMLElement;
      const r = Number(cellEl.dataset.row);
      const c = Number(cellEl.dataset.col);
      const cell = { r, c };
      const index = pathIndex.get(keyOf(cell));
      const isBlocked = state.level.blocked[r][c];
      const isStart = sameCell(cell, state.level.start);
      const isHead = index === state.path.length - 1;
      const classes = ["cell"];

      if (isBlocked) {
        classes.push("blocked");
      }
      if (isStart) {
        classes.push("start");
      }
      if (index !== undefined) {
        classes.push("in-path");
        const previous = state.path[index - 1];
        const next = state.path[index + 1];
        if (previous) {
          classes.push(directionClass(cell, previous));
        }
        if (next) {
          classes.push(directionClass(cell, next));
        }
      }
      if (isHead) {
        classes.push("head");
      }
      if (shell.classList.contains("is-winning") && index !== undefined) {
        classes.push("win-step");
      }

      cellEl.className = classes.join(" ");
      cellEl.style.setProperty("--path-index", String(index ?? 0));
      const label = cellEl.querySelector<HTMLElement>(".cell-label");
      if (label) {
        label.textContent = isStart ? "S" : "";
      }
    }
  };

  const setWon = (isWon: boolean): void => {
    shell.classList.toggle("is-winning", isWon);
    overlay.hidden = !isWon;
    nextButton.disabled = state.level.id >= MAX_LEVEL;
    nextButton.textContent = state.level.id >= MAX_LEVEL ? "ครบ 100 ด่าน" : "ด่านต่อไป";
    update();
  };

  update();

  return {
    grid,
    backButton,
    resetButton,
    nextButton,
    setWon,
    update,
  };
}
