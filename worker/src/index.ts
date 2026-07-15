import { MatchRoom } from "./MatchRoom";
import { Lobby } from "./Lobby";

export { MatchRoom, Lobby };

export interface Env {
  MATCH_ROOM: DurableObjectNamespace;
  LOBBY: DurableObjectNamespace;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    // /ws/room/:code → one MatchRoom DO per match (id = room code)
    const roomMatch = path.match(/^\/ws\/room\/([A-Za-z0-9_-]{1,32})$/);
    if (roomMatch) {
      const code = roomMatch[1].toLowerCase();
      const stub = env.MATCH_ROOM.get(env.MATCH_ROOM.idFromName(code));
      return stub.fetch(request);
    }

    // /ws/lobby → single global Lobby DO (random matchmaking queue)
    if (path === "/ws/lobby") {
      const stub = env.LOBBY.get(env.LOBBY.idFromName("global"));
      return stub.fetch(request);
    }

    if (path === "/" || path === "/health") {
      return new Response("puzzle-path-mp ok", {
        headers: { "content-type": "text/plain", ...CORS },
      });
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },
};
