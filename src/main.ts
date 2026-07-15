import { assertAllLevelsSolvable, generateLevel } from "./game/generator";
import { gameAudio } from "./game/audio";
import { renderLevelSelect } from "./game/levelselect";
import { renderGame } from "./game/render";
import { createGameState } from "./game/state";
import { type GameProgress, MAX_LEVEL } from "./game/types";
import { wireInput } from "./game/input";
import { renderHome } from "./game/home";
import { renderMatch } from "./game/matchview";
import { loadNickname } from "./game/match";
import { MP_ENABLED } from "./net/config";
import "./style.css";

const STORAGE_KEY = "puzzle-path-progress";

function clampLevel(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
}

function loadProgress(): GameProgress {
  const fallback = { currentLevel: 1, unlockedLevel: 1 };
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GameProgress>;
    const unlockedLevel = clampLevel(Number(parsed.unlockedLevel ?? 1));
    const currentLevel = Math.min(clampLevel(Number(parsed.currentLevel ?? unlockedLevel)), unlockedLevel);
    return { currentLevel, unlockedLevel };
  } catch {
    return fallback;
  }
}

function saveProgress(progress: GameProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function setRoomParam(room: string | null): void {
  const url = new URL(location.href);
  if (room) {
    url.searchParams.set("room", room);
  } else {
    url.searchParams.delete("room");
  }
  history.replaceState(null, "", url);
}

function startApp(): void {
  gameAudio.bindFirstGesture();

  const app = document.querySelector<HTMLElement>("#app");
  if (!app) {
    throw new Error("Missing #app root");
  }

  let progress = loadProgress();

  const showHome = (joinRoom?: string): void => {
    renderHome(app, { onSolo: showLevelSelect, onEnterMatch: enterMatch }, { joinRoom });
  };

  const showLevelSelect = (): void => {
    renderLevelSelect(app, progress, openLevel, () => showHome());
  };

  const enterMatch = (room: string, name: string): void => {
    setRoomParam(room);
    renderMatch(app, {
      room,
      name,
      onExit: () => {
        setRoomParam(null);
        showHome();
      },
    });
  };

  const openLevel = (levelId: number): void => {
    const level = generateLevel(levelId);
    const state = createGameState(level);
    const handles = renderGame(app, state);

    progress = {
      currentLevel: level.id,
      unlockedLevel: Math.max(progress.unlockedLevel, level.id),
    };
    saveProgress(progress);

    wireInput(state, handles, {
      onWin: () => {
        progress = {
          currentLevel: level.id,
          unlockedLevel: Math.max(progress.unlockedLevel, Math.min(MAX_LEVEL, level.id + 1)),
        };
        saveProgress(progress);
      },
    });

    handles.backButton.addEventListener("click", () => {
      gameAudio.playSoftClick();
      showLevelSelect();
    });

    handles.resetButton.addEventListener("click", () => {
      gameAudio.playReset();
      state.reset();
      handles.setWon(false);
      handles.update();
    });

    handles.nextButton.addEventListener("click", () => {
      if (level.id < MAX_LEVEL) {
        gameAudio.playSoftClick();
        openLevel(level.id + 1);
      }
    });
  };

  if (import.meta.env.DEV) {
    assertAllLevelsSolvable();
  }

  const room = new URLSearchParams(location.search).get("room");
  if (room && MP_ENABLED) {
    const name = loadNickname();
    if (name) {
      enterMatch(room, name);
    } else {
      showHome(room);
    }
  } else {
    showHome();
  }
}

startApp();
