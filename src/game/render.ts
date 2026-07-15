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

  const cellRefs: { el: HTMLElement; r: number; c: number }[] = [];

  for (let r = 0; r < state.level.rows; r += 1) {
    for (let c = 0; c < state.level.cols; c += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      const label = document.createElement("span");
      label.className = "cell-label";
      label.textContent = sameCell({ r, c }, state.level.start) ? "S" : "";
      const particles = document.createElement("span");
      particles.className = "cell-particles";
      cell.append(label, particles);
      grid.append(cell);
      cellRefs.push({ el: cell, r, c });
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

  // Geometry cache — measured once per layout change, never during a drag.
  // Reading getBoundingClientRect on every pointermove forced a synchronous
  // layout (thrash) and made dragging feel laggy; now the trail is pure math.
  const cellCenters = new Map<string, { x: number; y: number }>();

  const measureGeometry = (): void => {
    const gridRect = grid.getBoundingClientRect();
    pathOverlay.setAttribute("viewBox", `0 0 ${gridRect.width} ${gridRect.height}`);
    pathOverlay.setAttribute("width", String(gridRect.width));
    pathOverlay.setAttribute("height", String(gridRect.height));
    gradient.setAttribute("x2", String(gridRect.width));

    cellCenters.clear();
    let cellWidth = 0;
    for (const { el, r, c } of cellRefs) {
      const rect = el.getBoundingClientRect();
      cellCenters.set(`${r},${c}`, {
        x: rect.left - gridRect.left + rect.width / 2,
        y: rect.top - gridRect.top + rect.height / 2,
      });
      if (cellWidth === 0) {
        cellWidth = rect.width;
      }
    }
    pathLine.setAttribute("stroke-width", String(Math.max(12, cellWidth * 0.4)));
  };

  const updatePathOverlay = (): void => {
    const points: string[] = [];
    for (const cell of state.path) {
      const center = cellCenters.get(keyOf(cell));
      if (center) {
        points.push(`${center.x},${center.y}`);
      }
    }
    pathLine.setAttribute("points", points.join(" "));
  };

  const resizeObserver = new ResizeObserver(() => {
    measureGeometry();
    updatePathOverlay();
  });
  resizeObserver.observe(grid);

  const update = (): void => {
    const pathIndex = new Map<string, number>();
    state.path.forEach((cell, index) => pathIndex.set(keyOf(cell), index));

    const isWinning = shell.classList.contains("is-winning");
    const headIndex = state.path.length - 1;

    for (const { el, r, c } of cellRefs) {
      const index = pathIndex.get(`${r},${c}`);
      const classes = ["cell"];

      if (state.level.blocked[r][c]) {
        classes.push("blocked");
      }
      if (r === state.level.start.r && c === state.level.start.c) {
        classes.push("start");
      }
      if (index !== undefined) {
        classes.push("in-path");
        el.style.setProperty("--path-index", String(index));
        if (index === headIndex) {
          classes.push("head");
        }
        if (isWinning) {
          classes.push("win-step");
        }
      }

      el.className = classes.join(" ");
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

  measureGeometry();
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
