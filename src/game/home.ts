import { gameAudio } from "./audio";
import { MP_ENABLED } from "../net/config";
import { challengeLink, loadNickname, newRoomCode, saveNickname } from "./match";
import { matchmake as matchmakeCancelable } from "../net/mp";

type HomeCallbacks = {
  onSolo: () => void;
  onEnterMatch: (room: string, name: string) => void;
};

type HomeOptions = {
  // Set when the page was opened via a challenge link (?room=<code>).
  joinRoom?: string;
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

export function renderHome(app: HTMLElement, cb: HomeCallbacks, options: HomeOptions = {}): void {
  app.innerHTML = "";
  let cancelMatchmake: (() => void) | null = null;

  const shell = el("main", "home-shell");

  const hero = el("div", "home-hero");
  hero.append(el("h1", "home-title", "PUZZLE PATH"));
  hero.append(el("p", "home-tagline", "ลากเส้นเดียวผ่านทุกแผ่นหินเหนือลาวา"));

  const nameField = el("div", "home-field");
  nameField.append(el("label", "home-label", "ชื่อเล่นของคุณ"));
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "home-input";
  nameInput.maxLength = 24;
  nameInput.placeholder = "พิมพ์ชื่อ…";
  nameInput.value = loadNickname();
  nameField.append(nameInput);

  const menu = el("div", "home-menu");

  if (options.joinRoom && MP_ENABLED) {
    hero.append(el("p", "home-invite", "เพื่อนชวนคุณแข่ง! ตั้งชื่อแล้วกดเข้าร่วม"));
    const joinBtn = button("เข้าร่วมแมตช์", "primary-button home-btn home-btn-join");
    joinBtn.addEventListener("click", () => {
      gameAudio.playSoftClick();
      const name = requireName();
      if (!name) return;
      cancelMatchmake?.();
      cb.onEnterMatch(options.joinRoom!, name);
    });
    menu.append(joinBtn);
  }

  const soloBtn = button("เล่นคนเดียว", "primary-button home-btn");
  menu.append(soloBtn);

  const panel = el("div", "home-panel");
  panel.hidden = true;

  const getName = (): string => nameInput.value.trim();

  const requireName = (): string | null => {
    const name = getName();
    if (!name) {
      nameInput.focus();
      nameInput.classList.add("shake");
      setTimeout(() => nameInput.classList.remove("shake"), 400);
      return null;
    }
    saveNickname(name);
    return name;
  };

  soloBtn.addEventListener("click", () => {
    gameAudio.playSoftClick();
    const name = getName();
    if (name) saveNickname(name);
    cancelMatchmake?.();
    cb.onSolo();
  });

  if (MP_ENABLED) {
    const challengeBtn = button("ท้าเพื่อน (สร้างลิงก์)", "control-button home-btn");
    const randomBtn = button("สุ่มคู่แข่งออนไลน์", "control-button home-btn");
    menu.append(challengeBtn, randomBtn);

    challengeBtn.addEventListener("click", () => {
      gameAudio.playSoftClick();
      const name = requireName();
      if (!name) return;
      cancelMatchmake?.();
      const room = newRoomCode();
      const link = challengeLink(room);

      panel.hidden = false;
      panel.innerHTML = "";
      panel.append(el("div", "home-panel-title", "ส่งลิงก์นี้ให้เพื่อน แล้วกดเข้าห้องเพื่อรอ"));
      const linkRow = el("div", "home-linkrow");
      const linkText = document.createElement("input");
      linkText.type = "text";
      linkText.readOnly = true;
      linkText.className = "home-linkinput";
      linkText.value = link;
      const copyBtn = button("คัดลอก", "control-button");
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(link);
          copyBtn.textContent = "คัดลอกแล้ว ✓";
          setTimeout(() => (copyBtn.textContent = "คัดลอก"), 1500);
        } catch {
          linkText.select();
        }
      });
      linkRow.append(linkText, copyBtn);
      panel.append(linkRow);

      const enterBtn = button("เข้าห้อง (รอเพื่อน)", "primary-button");
      enterBtn.addEventListener("click", () => {
        gameAudio.playSoftClick();
        cb.onEnterMatch(room, name);
      });
      panel.append(enterBtn);
    });

    randomBtn.addEventListener("click", () => {
      gameAudio.playSoftClick();
      const name = requireName();
      if (!name) return;
      cancelMatchmake?.();

      panel.hidden = false;
      panel.innerHTML = "";
      panel.append(el("div", "home-panel-title", "กำลังหาคู่แข่งออนไลน์…"));
      const spinner = el("div", "home-spinner");
      panel.append(spinner);
      const cancelBtn = button("ยกเลิก", "control-button subtle-button");
      panel.append(cancelBtn);

      cancelMatchmake = matchmakeCancelable(
        name,
        (room) => {
          cancelMatchmake = null;
          cb.onEnterMatch(room, name);
        },
        () => {
          panel.innerHTML = "";
          panel.append(el("div", "home-panel-title", "หาคู่ไม่สำเร็จ ลองใหม่อีกครั้ง"));
        },
      );

      cancelBtn.addEventListener("click", () => {
        cancelMatchmake?.();
        cancelMatchmake = null;
        panel.hidden = true;
      });
    });
  } else {
    menu.append(el("p", "home-note", "โหมดผู้เล่นหลายคนยังไม่พร้อม (ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์)"));
  }

  shell.append(hero, nameField, menu, panel);
  app.append(shell);
}
