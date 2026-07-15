import type { Env } from "./index";

const TOTAL_LEVELS = 10;
const ROUND_END_TIMEOUT_MS = 6000;

type Player = { name: string; score: number; connected: boolean };
type Phase = "waiting" | "playing" | "roundEnd" | "ended";

type MatchState = {
  players: Player[];
  levelIndex: number;
  phase: Phase;
  roundWinner: number | null;
  roundReady: number[];
};

const initialState = (): MatchState => ({
  players: [],
  levelIndex: 0,
  phase: "waiting",
  roundWinner: null,
  roundReady: [],
});

type Incoming =
  | { t: "join"; name?: string }
  | { t: "win"; level?: number }
  | { t: "surrender" }
  | { t: "ready" };

/**
 * One Durable Object instance per match (id = room code).
 * Holds 2 players, the current round (0..9), scores, and drives the
 * round lifecycle: playing → roundEnd (winner shown, wait for both
 * `ready` or a timeout) → next level → ... → ended.
 */
export class MatchRoom {
  private state: DurableObjectState;
  private data!: MatchState;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      this.data = (await this.state.storage.get<MatchState>("state")) ?? initialState();
    });
  }

  private async save(): Promise<void> {
    await this.state.storage.put("state", this.data);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private slotOf(ws: WebSocket): number | null {
    const att = ws.deserializeAttachment() as { slot: number } | null;
    return att ? att.slot : null;
  }

  private broadcast(msg: unknown): void {
    const text = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(text);
      } catch {
        /* socket closing — ignore */
      }
    }
  }

  private stateMsg() {
    return {
      t: "state",
      players: this.data.players.map((p) => ({
        name: p.name,
        score: p.score,
        connected: p.connected,
      })),
      level: this.data.levelIndex,
      total: TOTAL_LEVELS,
      phase: this.data.phase,
    };
  }

  private scores(): number[] {
    return this.data.players.map((p) => p.score);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let msg: Incoming;
    try {
      msg = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }

    switch (msg.t) {
      case "join":
        this.handleJoin(ws, String(msg.name ?? "ผู้เล่น").slice(0, 24) || "ผู้เล่น");
        break;
      case "win":
        this.handleWin(ws, Number(msg.level));
        break;
      case "surrender":
        this.handleSurrender(ws);
        break;
      case "ready":
        this.handleReady(ws);
        break;
    }
    await this.save();
  }

  private handleJoin(ws: WebSocket, name: string): void {
    let slot = this.slotOf(ws);
    if (slot === null) {
      const reclaim = this.data.players.findIndex((p) => !p.connected && p.name === name);
      if (reclaim >= 0) {
        slot = reclaim;
      } else if (this.data.players.length < 2) {
        slot = this.data.players.length;
        this.data.players.push({ name, score: 0, connected: true });
      } else {
        try {
          ws.send(JSON.stringify({ t: "full" }));
          ws.close(4001, "room full");
        } catch {
          /* ignore */
        }
        return;
      }
      ws.serializeAttachment({ slot });
    }

    this.data.players[slot].name = name;
    this.data.players[slot].connected = true;

    if (this.data.players.length === 2 && this.data.phase === "waiting") {
      this.data.phase = "playing";
    }

    try {
      ws.send(JSON.stringify({ t: "you", slot }));
    } catch {
      /* ignore */
    }
    this.broadcast(this.stateMsg());
  }

  private handleWin(ws: WebSocket, level: number): void {
    const slot = this.slotOf(ws);
    if (slot === null || this.data.phase !== "playing") return;
    if (level !== this.data.levelIndex) return; // stale / wrong round
    this.awardRound(slot, undefined);
  }

  private handleSurrender(ws: WebSocket): void {
    const slot = this.slotOf(ws);
    if (slot === null || this.data.phase !== "playing") return;
    const opponent = slot === 0 ? 1 : 0;
    if (!this.data.players[opponent]) return;
    this.awardRound(opponent, slot);
  }

  private awardRound(winner: number, surrenderedBy: number | undefined): void {
    this.data.roundWinner = winner;
    this.data.players[winner].score += 1;
    this.data.phase = "roundEnd";
    this.data.roundReady = [];
    this.broadcast({
      t: "levelWon",
      winner,
      level: this.data.levelIndex,
      surrendered: surrenderedBy ?? null,
      scores: this.scores(),
    });
    void this.state.storage.setAlarm(Date.now() + ROUND_END_TIMEOUT_MS);
  }

  private handleReady(ws: WebSocket): void {
    if (this.data.phase !== "roundEnd") return;
    const slot = this.slotOf(ws);
    if (slot === null) return;
    if (!this.data.roundReady.includes(slot)) {
      this.data.roundReady.push(slot);
    }
    const connectedSlots = this.data.players
      .map((p, i) => (p.connected ? i : -1))
      .filter((i) => i >= 0);
    const allReady = connectedSlots.every((i) => this.data.roundReady.includes(i));
    if (allReady) {
      this.advance();
    }
  }

  async alarm(): Promise<void> {
    // Fallback: if a client never sends `ready` (e.g. dropped), advance anyway.
    if (this.data.phase === "roundEnd") {
      this.advance();
      await this.save();
    }
  }

  private advance(): void {
    void this.state.storage.deleteAlarm();
    this.data.levelIndex += 1;
    this.data.roundWinner = null;
    this.data.roundReady = [];

    if (this.data.levelIndex >= TOTAL_LEVELS) {
      this.data.phase = "ended";
      const scores = this.scores();
      let winner: number | null = null;
      if (scores.length === 2) {
        winner = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
      }
      this.broadcast({ t: "matchEnd", winner, scores });
    } else {
      this.data.phase = "playing";
      this.broadcast(this.stateMsg());
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const slot = this.slotOf(ws);
    if (slot !== null && this.data.players[slot]) {
      this.data.players[slot].connected = false;
      await this.save();
      this.broadcast({ t: "opponentLeft", slot });
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }
}
