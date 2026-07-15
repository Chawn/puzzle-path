import { generateLevel } from "./generator";
import { createGameState } from "./state";
import { renderGame } from "./render";
import { wireInput } from "./input";
import { gameAudio } from "./audio";
import { MATCH_LEVEL_IDS, MATCH_TOTAL } from "./match";
import { MatchClient, type PlayerInfo } from "../net/mp";

type MatchViewOptions = {
  room: string;
  name: string;
  onExit: () => void;
};

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function button(label: string, className: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = label;
  return b;
}

export function renderMatch(app: HTMLElement, opts: MatchViewOptions): () => void {
  app.innerHTML = "";
  const client = new MatchClient();

  let mySlot: number | null = null;
  let currentLevel = -1;
  let players: PlayerInfo[] = [];
  let readyTimer: number | null = null;
  let ended = false;

  const root = el("div", "match-root");

  const hud = el("div", "match-hud");
  const scoreBar = el("div", "match-scorebar");
  const roundLabel = el("div", "match-round", `ด่าน — / ${MATCH_TOTAL}`);
  const statusLabel = el("div", "match-status", "กำลังเชื่อมต่อ...");
  const actions = el("div", "match-actions");
  const surrenderBtn = button("ยอมแพ้ด่านนี้", "control-button danger-button");
  const exitBtn = button("ออก", "control-button subtle-button");
  actions.append(surrenderBtn, exitBtn);
  hud.append(scoreBar, roundLabel, statusLabel, actions);

  const boardHost = el("div", "match-board in-match");

  const overlay = el("div", "match-overlay");
  overlay.hidden = true;
  const overlayCard = el("div", "match-overlay-card");
  overlay.append(overlayCard);

  root.append(hud, boardHost, overlay);
  app.append(root);

  const scoreChip = (name: string, score: number, kind: string, offline = false): HTMLElement => {
    const chip = el("div", `match-chip match-chip-${kind}${offline ? " is-offline" : ""}`);
    chip.append(el("span", "match-chip-name", name), el("span", "match-chip-score", String(score)));
    return chip;
  };

  const renderHud = (): void => {
    const me = mySlot !== null ? players[mySlot] : undefined;
    const opp = mySlot !== null ? players[mySlot === 0 ? 1 : 0] : undefined;
    scoreBar.innerHTML = "";
    scoreBar.append(
      scoreChip(`${me?.name ?? opts.name} (คุณ)`, me?.score ?? 0, "me"),
      el("div", "match-vs", "VS"),
      scoreChip(opp?.name ?? "รอคู่แข่ง…", opp?.score ?? 0, "opp", opp ? !opp.connected : true),
    );
    roundLabel.textContent = `ด่าน ${Math.min(currentLevel + 1, MATCH_TOTAL) || "—"} / ${MATCH_TOTAL}`;
  };

  const clearReadyTimer = (): void => {
    if (readyTimer !== null) {
      clearTimeout(readyTimer);
      readyTimer = null;
    }
  };

  const loadLevel = (levelIndex: number): void => {
    currentLevel = levelIndex;
    overlay.hidden = true;
    const level = generateLevel(MATCH_LEVEL_IDS[levelIndex]);
    const state = createGameState(level);
    const handles = renderGame(boardHost, state);
    wireInput(state, handles, {
      suppressWinOverlay: true,
      onWin: () => {
        statusLabel.textContent = "ลากครบแล้ว! รอผลจากเซิร์ฟเวอร์…";
        client.sendWin(levelIndex);
      },
    });
    statusLabel.textContent = "ลากเส้นให้ครบก่อนคู่แข่ง!";
    renderHud();
  };

  const showRoundResult = (won: boolean, surrendered: boolean): void => {
    overlayCard.className = "match-overlay-card";
    overlayCard.innerHTML = "";
    const title = won ? "คุณชนะรอบนี้! 🔥" : surrendered ? "คุณยอมแพ้รอบนี้" : "คู่แข่งชนะรอบนี้";
    overlayCard.append(el("strong", "match-overlay-title", title));
    overlayCard.append(el("div", "match-overlay-sub", "กำลังไปด่านต่อไป…"));
    overlay.hidden = false;
  };

  const showMatchEnd = (winner: number | null, scores: number[]): void => {
    ended = true;
    clearReadyTimer();
    overlayCard.className = "match-overlay-card match-overlay-end";
    overlayCard.innerHTML = "";
    const title =
      winner === null ? "เสมอ!" : winner === mySlot ? "คุณชนะแมตช์! 🏆" : "คู่แข่งชนะแมตช์";
    const my = mySlot !== null ? scores[mySlot] ?? 0 : 0;
    const opp = mySlot !== null ? scores[mySlot === 0 ? 1 : 0] ?? 0 : 0;
    overlayCard.append(el("strong", "match-overlay-title", title));
    overlayCard.append(el("div", "match-overlay-score", `${my} — ${opp}`));
    const backBtn = button("กลับหน้าหลัก", "primary-button");
    backBtn.addEventListener("click", () => {
      gameAudio.playSoftClick();
      teardown();
      opts.onExit();
    });
    overlayCard.append(backBtn);
    overlay.hidden = false;
  };

  surrenderBtn.addEventListener("click", () => {
    if (ended) return;
    gameAudio.playSoftClick();
    client.sendSurrender();
  });

  exitBtn.addEventListener("click", () => {
    gameAudio.playSoftClick();
    teardown();
    opts.onExit();
  });

  const teardown = (): void => {
    clearReadyTimer();
    client.close();
  };

  client.connect(opts.room, opts.name, {
    onYou: (slot) => {
      mySlot = slot;
      renderHud();
    },
    onState: (m) => {
      players = m.players;
      if (m.phase === "waiting") {
        statusLabel.textContent = "รอคู่แข่งเข้าห้อง…";
        overlay.hidden = true;
      } else if (m.phase === "playing" && m.level !== currentLevel) {
        clearReadyTimer();
        loadLevel(m.level);
      }
      renderHud();
    },
    onLevelWon: (m) => {
      if (mySlot !== null && m.scores.length) {
        players = players.map((p, i) => ({ ...p, score: m.scores[i] ?? p.score }));
      }
      const won = m.winner === mySlot;
      const iSurrendered = m.surrendered === mySlot;
      if (won) {
        gameAudio.playWin();
      }
      renderHud();
      showRoundResult(won, iSurrendered);
      // Acknowledge so the server advances once both players are ready.
      clearReadyTimer();
      readyTimer = setTimeout(() => client.sendReady(), 1500) as unknown as number;
    },
    onMatchEnd: (m) => {
      showMatchEnd(m.winner, m.scores);
    },
    onOpponentLeft: () => {
      if (mySlot !== null && players[mySlot === 0 ? 1 : 0]) {
        players[mySlot === 0 ? 1 : 0].connected = false;
      }
      if (!ended) {
        statusLabel.textContent = "คู่แข่งหลุดการเชื่อมต่อ — รออีกครั้ง…";
      }
      renderHud();
    },
    onFull: () => {
      statusLabel.textContent = "ห้องนี้เต็มแล้ว (2 คน)";
      overlayCard.className = "match-overlay-card";
      overlayCard.innerHTML = "";
      overlayCard.append(el("strong", "match-overlay-title", "ห้องเต็มแล้ว"));
      const backBtn = button("กลับหน้าหลัก", "primary-button");
      backBtn.addEventListener("click", () => {
        teardown();
        opts.onExit();
      });
      overlayCard.append(backBtn);
      overlay.hidden = false;
    },
    onClose: () => {
      if (!ended) {
        statusLabel.textContent = "การเชื่อมต่อหลุด";
      }
    },
  });

  return teardown;
}
