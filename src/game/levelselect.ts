import { type GameProgress, MAX_LEVEL } from "./types";
import { gameAudio } from "./audio";

export function renderLevelSelect(
  app: HTMLElement,
  progress: GameProgress,
  onOpenLevel: (levelId: number) => void,
): void {
  app.innerHTML = "";

  const shell = document.createElement("main");
  shell.className = "select-shell";

  const header = document.createElement("header");
  header.className = "select-header";

  const title = document.createElement("div");
  title.className = "select-title";
  title.textContent = "เลือกด่าน";

  const status = document.createElement("div");
  status.className = "select-status";
  status.textContent = `ปลดล็อกถึงด่าน ${progress.unlockedLevel}/${MAX_LEVEL}`;

  const headerControls = document.createElement("div");
  headerControls.className = "select-header-controls";
  headerControls.append(status, gameAudio.createMuteButton());

  header.append(title, headerControls);

  const grid = document.createElement("section");
  grid.className = "level-grid";
  grid.setAttribute("aria-label", "เลือกด่าน 1 ถึง 100");

  for (let levelId = 1; levelId <= MAX_LEVEL; levelId += 1) {
    const button = document.createElement("button");
    const isUnlocked = levelId <= progress.unlockedLevel;
    const isCurrent = levelId === progress.currentLevel;

    button.type = "button";
    button.className = [
      "level-tile",
      isUnlocked ? "unlocked" : "locked",
      isCurrent ? "current" : "",
    ].filter(Boolean).join(" ");
    button.textContent = String(levelId);
    button.disabled = !isUnlocked;
    button.setAttribute("aria-label", isUnlocked ? `เล่นด่าน ${levelId}` : `ด่าน ${levelId} ยังล็อก`);

    if (isUnlocked) {
      button.addEventListener("click", () => {
        gameAudio.playSoftClick();
        onOpenLevel(levelId);
      });
    }

    grid.append(button);
  }

  shell.append(header, grid);
  app.append(shell);
}
