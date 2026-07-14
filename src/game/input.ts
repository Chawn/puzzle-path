import { type RenderHandles } from "./render";
import { type GameState } from "./state";
import { type Cell } from "./types";
import { gameAudio } from "./audio";

type InputOptions = {
  onWin: () => void;
};

const sameCell = (a: Cell, b: Cell): boolean => a.r === b.r && a.c === b.c;

function cellFromElement(element: Element | null, grid: HTMLElement): Cell | null {
  const cellEl = element?.closest<HTMLElement>(".cell");
  if (!cellEl || !grid.contains(cellEl) || cellEl.dataset.row === undefined || cellEl.dataset.col === undefined) {
    return null;
  }

  return {
    r: Number(cellEl.dataset.row),
    c: Number(cellEl.dataset.col),
  };
}

export function wireInput(state: GameState, handles: RenderHandles, options: InputOptions): void {
  let dragging = false;
  let lastHandled: Cell | null = null;

  const handleCell = (cell: Cell): void => {
    if (lastHandled && sameCell(lastHandled, cell)) {
      return;
    }

    const previousLength = state.path.length;

    if (state.extend(cell)) {
      lastHandled = cell;
      handles.update();

      if (state.isWin()) {
        dragging = false;
        handles.setWon(true);
        gameAudio.playWin();
        options.onWin();
      } else if (state.path.length < previousLength) {
        gameAudio.playUndo();
      } else {
        gameAudio.playPathBlip(state.path.length);
      }
    }
  };

  handles.grid.addEventListener("pointerdown", (event) => {
    const cell = cellFromElement(event.target as Element, handles.grid);
    if (!cell) {
      return;
    }

    const head = state.path[state.path.length - 1];
    if (!sameCell(cell, state.level.start) && !sameCell(cell, head)) {
      return;
    }

    event.preventDefault();
    dragging = true;
    lastHandled = cell;
    handles.grid.setPointerCapture(event.pointerId);
  });

  handles.grid.addEventListener("pointermove", (event) => {
    if (!dragging) {
      return;
    }

    event.preventDefault();
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const cell = cellFromElement(element, handles.grid);
    if (cell) {
      handleCell(cell);
    }
  });

  const stopDragging = (event: PointerEvent): void => {
    if (dragging) {
      event.preventDefault();
    }
    dragging = false;
    lastHandled = null;
  };

  handles.grid.addEventListener("pointerup", stopDragging);
  handles.grid.addEventListener("pointercancel", stopDragging);
}
