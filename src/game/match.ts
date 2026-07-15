import { createPrng } from "./prng";

// The 10-level match ladder is seeded by room code so both players see the
// same easy-to-hard sequence while each room gets its own random levels.
export const MATCH_TOTAL = 10;

export function hashRoomCode(code: string): number {
  let hash = 2166136261;
  for (let i = 0; i < code.length; i += 1) {
    hash ^= code.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function matchLevelIds(roomCode: string): number[] {
  const prng = createPrng(hashRoomCode(roomCode));
  return Array.from({ length: MATCH_TOTAL }, (_, band) => band * 10 + 1 + prng.int(10));
}

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
