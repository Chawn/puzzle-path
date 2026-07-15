// The 10-level challenge ladder (easy → very hard), shared by both players.
// Deterministic: both clients call generateLevel(MATCH_LEVEL_IDS[round]) so
// they always see the same board for a given round. The Worker only counts
// score, so this sequence lives entirely client-side.
export const MATCH_LEVEL_IDS = [2, 9, 18, 28, 40, 52, 64, 76, 88, 100];
export const MATCH_TOTAL = MATCH_LEVEL_IDS.length;

const NAME_KEY = "puzzle-path-nickname";

export function loadNickname(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveNickname(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

export function newRoomCode(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function challengeLink(room: string): string {
  return `${location.origin}${location.pathname}?room=${room}`;
}
