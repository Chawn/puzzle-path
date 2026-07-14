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

  const gridBoard = document.createElement("div");
  gridBoard.className = "grid-board";
  gridBoard.style.setProperty("--rows", String(state.level.rows));
  gridBoard.style.setProperty("--cols", String(state.level.cols));

  const grid = document.createElement("div");
  grid.className = "grid";
  grid.style.setProperty("--rows", String(state.level.rows));
  grid.style.setProperty("--cols", String(state.level.cols));

  const pathOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  pathOverlay.classList.add("path-overlay");
  pathOverlay.setAttribute("aria-hidden", "true");
  pathOverlay.setAttribute("focusable", "false");

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  gradient.id = "path-molten-gradient";
  gradient.setAttribute("gradientUnits", "userSpaceOnUse");
  gradient.setAttribute("x1", "0");
  gradient.setAttribute("y1", "0");
  gradient.setAttribute("x2", "1");
  gradient.setAttribute("y2", "0");

  const goldStop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  goldStop.setAttribute("offset", "0%");
  goldStop.setAttribute("stop-color", "#fff3a5");

  const orangeStop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  orangeStop.setAttribute("offset", "52%");
  orangeStop.setAttribute("stop-color", "#ff9a22");

  const redStop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  redStop.setAttribute("offset", "100%");
  redStop.setAttribute("stop-color", "#ff3512");

  gradient.append(goldStop, orangeStop, redStop);

  const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
  filter.id = "path-molten-glow";
  filter.setAttribute("x", "-25%");
  filter.setAttribute("y", "-25%");
  filter.setAttribute("width", "150%");
  filter.setAttribute("height", "150%");

  const blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
  blur.setAttribute("stdDeviation", "7");
  blur.setAttribute("result", "blur");

  const merge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
  const glowNode = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
  glowNode.setAttribute("in", "blur");
  const sourceNode = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
  sourceNode.setAttribute("in", "SourceGraphic");
  merge.append(glowNode, sourceNode);
  filter.append(blur, merge);
  defs.append(gradient, filter);

  const pathLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  pathLine.classList.add("path-line");
  pathLine.setAttribute("fill", "none");
  pathLine.setAttribute("stroke", "url(#path-molten-gradient)");
  pathLine.setAttribute("stroke-linecap", "round");
  pathLine.setAttribute("stroke-linejoin", "round");
  pathLine.setAttribute("filter", "url(#path-molten-glow)");

  pathOverlay.append(defs, pathLine);

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

  gridBoard.append(grid, pathOverlay);
  gridWrap.append(gridBoard);

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

  const updatePathOverlay = (): void => {
    const gridRect = grid.getBoundingClientRect();
    pathOverlay.setAttribute("viewBox", `0 0 ${gridRect.width} ${gridRect.height}`);
    pathOverlay.setAttribute("width", String(gridRect.width));
    pathOverlay.setAttribute("height", String(gridRect.height));
    gradient.setAttribute("x2", String(gridRect.width));

    const points = state.path
      .map((cell) => {
        const cellEl = grid.querySelector<HTMLElement>(`.cell[data-row="${cell.r}"][data-col="${cell.c}"]`);
        if (!cellEl) {
          return null;
        }

        const rect = cellEl.getBoundingClientRect();
        return `${rect.left - gridRect.left + rect.width / 2},${rect.top - gridRect.top + rect.height / 2}`;
      })
      .filter((point): point is string => point !== null);

    const firstCell = grid.querySelector<HTMLElement>(".cell:not(.blocked)");
    const cellWidth = firstCell?.getBoundingClientRect().width ?? 0;
    pathLine.setAttribute("points", points.join(" "));
    pathLine.setAttribute("stroke-width", String(Math.max(12, cellWidth * 0.4)));
  };

  const resizeObserver = new ResizeObserver(() => {
    updatePathOverlay();
  });
  resizeObserver.observe(grid);

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

    updatePathOverlay();
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
