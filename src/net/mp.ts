import { MP_WS_BASE } from "./config";

export type PlayerInfo = { name: string; score: number; connected: boolean };

export type ServerMsg =
  | { t: "you"; slot: number }
  | { t: "state"; players: PlayerInfo[]; level: number; total: number; phase: string }
  | { t: "levelWon"; winner: number; level: number; surrendered: number | null; scores: number[] }
  | { t: "matchEnd"; winner: number | null; scores: number[] }
  | { t: "opponentLeft"; slot: number }
  | { t: "full" };

export type MatchHandlers = {
  onYou?: (slot: number) => void;
  onState?: (m: Extract<ServerMsg, { t: "state" }>) => void;
  onLevelWon?: (m: Extract<ServerMsg, { t: "levelWon" }>) => void;
  onMatchEnd?: (m: Extract<ServerMsg, { t: "matchEnd" }>) => void;
  onOpponentLeft?: (m: Extract<ServerMsg, { t: "opponentLeft" }>) => void;
  onFull?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
};

export class MatchClient {
  private ws: WebSocket | null = null;
  private handlers: MatchHandlers = {};
  private name = "ผู้เล่น";
  slot: number | null = null;

  connect(roomCode: string, name: string, handlers: MatchHandlers): void {
    this.name = name;
    this.handlers = handlers;
    const ws = new WebSocket(`${MP_WS_BASE}/ws/room/${encodeURIComponent(roomCode)}`);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.send({ t: "join", name: this.name });
      handlers.onOpen?.();
    });
    ws.addEventListener("message", (event) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }
      this.dispatch(msg);
    });
    ws.addEventListener("close", () => handlers.onClose?.());
    ws.addEventListener("error", () => handlers.onClose?.());
  }

  private dispatch(msg: ServerMsg): void {
    switch (msg.t) {
      case "you":
        this.slot = msg.slot;
        this.handlers.onYou?.(msg.slot);
        break;
      case "state":
        this.handlers.onState?.(msg);
        break;
      case "levelWon":
        this.handlers.onLevelWon?.(msg);
        break;
      case "matchEnd":
        this.handlers.onMatchEnd?.(msg);
        break;
      case "opponentLeft":
        this.handlers.onOpponentLeft?.(msg);
        break;
      case "full":
        this.handlers.onFull?.();
        break;
    }
  }

  private send(obj: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  sendWin(level: number): void {
    this.send({ t: "win", level });
  }

  sendSurrender(): void {
    this.send({ t: "surrender" });
  }

  sendReady(): void {
    this.send({ t: "ready" });
  }

  close(): void {
    this.handlers = {};
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
  }
}

/**
 * Join the random-match queue. Resolves with a room code once the server
 * pairs us with another waiting player. Returns a cancel function.
 */
export function matchmake(
  name: string,
  onMatched: (room: string) => void,
  onError: () => void,
): () => void {
  const ws = new WebSocket(`${MP_WS_BASE}/ws/lobby`);
  let done = false;

  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ t: "queue", name }));
  });
  ws.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.t === "matched" && typeof msg.room === "string") {
        done = true;
        onMatched(msg.room);
      }
    } catch {
      /* ignore */
    }
  });
  ws.addEventListener("error", () => {
    if (!done) onError();
  });
  ws.addEventListener("close", () => {
    if (!done) onError();
  });

  return () => {
    done = true;
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  };
}
