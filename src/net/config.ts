// WebSocket base for the multiplayer Worker.
// Priority: ?mp=<wsBase> query override → VITE_MP_WS_BASE build var →
// localhost in dev → empty (multiplayer disabled) in prod until configured.
function resolveBase(): string {
  const override = new URLSearchParams(location.search).get("mp");
  if (override) {
    return override.replace(/\/$/, "");
  }
  const buildVar = (import.meta.env.VITE_MP_WS_BASE as string | undefined)?.trim();
  if (buildVar) {
    return buildVar.replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return "ws://localhost:8787";
  }
  return "";
}

export const MP_WS_BASE = resolveBase();

export const MP_ENABLED = MP_WS_BASE.length > 0;
