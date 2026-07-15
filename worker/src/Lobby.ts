import type { Env } from "./index";

type Incoming = { t: "queue"; name?: string };

/**
 * Single global Durable Object: the random-match queue.
 * A client connects, sends `queue`, and waits. When a second client
 * queues, both are handed the same freshly-minted room code and told to
 * reconnect to /ws/room/:code, then their lobby sockets close.
 */
export class Lobby {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let msg: Incoming;
    try {
      msg = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }
    if (msg.t !== "queue") return;

    ws.serializeAttachment({ queued: true });

    const peer = this.state.getWebSockets().find((other) => {
      if (other === ws) return false;
      const a = other.deserializeAttachment() as { queued?: boolean } | null;
      return a?.queued === true;
    });

    if (peer) {
      const room = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      for (const socket of [ws, peer]) {
        socket.serializeAttachment({ queued: false });
        try {
          socket.send(JSON.stringify({ t: "matched", room }));
          socket.close(1000, "matched");
        } catch {
          /* ignore */
        }
      }
    }
  }
}
