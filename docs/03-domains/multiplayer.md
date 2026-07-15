# Multiplayer — ท้าแข่ง + จับคู่อัตโนมัติ — DESIGN
> DESIGN 2026-07-15 · owner: Cloudflare Worker (แยกจาก Pages frontend)
> **Out of scope:** ranking ถาวร/บัญชีผู้ใช้ (ชื่อเก็บ client-side ส่งตอน join) · chat · spectator · anti-cheat จริงจัง · เสียง (มีแล้ว) · เกม solo เดิม (คงไว้)

## 1. ทำไม (why + constraint)
เพิ่มโหมดแข่งกับเพื่อน/คนออนไลน์: ตั้งชื่อ → ส่งลิงก์ท้า หรือสุ่มจับคู่ → แข่งเป็นด่านๆ ใครลากครบก่อนได้แต้ม → best of 10 ด่าน (ง่าย→ยากมาก). solo เดิมยังเล่นได้.
Constraint: realtime (ชนะ "ก่อน" + คนออนไลน์) → ต้อง backend. เลือก **Cloudflare Workers + Durable Objects** (free tier, WebSocket hibernation) — deploy คู่กับ Pages เดิม, ฟรีในระดับเล่นกับเพื่อน.

## 2. Foundation ที่มีอยู่แล้ว ❗ ห้ามสร้างซ้ำ
- `src/game/generator.ts` — `generateLevel(id)` deterministic + solvable → **reuse ทั้ง client + Worker** (แชร์ logic เดียว) เพื่อให้ทั้งคู่เห็นด่านเดียวกันจาก seed
- `src/game/state.ts` `render.ts` `input.ts` — เกม 1 ด่าน reuse ได้
- localStorage progress (solo) — คงไว้

## 3. Decisions
- **D1 — Cloudflare Workers + Durable Objects** (ไม่ใช่ server อื่น) — ตรง infra เดิม, ฟรี, WebSocket hibernation ลด cost
- **D2 — 2 DO class:**
  - `MatchRoom` — 1 instance ต่อ 1 แมตช์ (id = roomCode). ถือ state: ผู้เล่น 2 คน, ด่านปัจจุบัน (1-10), คะแนน, สถานะ. broadcast ผ่าน WebSocket
  - `Lobby` (single instance) — คิวจับคู่สุ่ม: ใครกด "สุ่ม" เข้าคิว, พอครบ 2 → สร้าง roomCode → ส่งให้ทั้งคู่ redirect เข้า MatchRoom
- **D3 — Challenge link** = `?room=<code>` → เข้า MatchRoom โดยตรง (คนแรกสร้างห้อง, คนที่สองเข้าด้วยลิงก์)
- **D4 — แข่ง 10 ด่าน** seed = fixed (เช่น roomCode hash + levelIndex 1..10) ให้ทั้งคู่เห็นด่านเดียวกัน. ง่าย→ยากมาก (difficulty band บีบ 100→10)
- **D5 — ชนะด่าน** = คนแรกที่ isWin() ส่ง event → Worker ตัดสิน (server-authoritative timestamp) → +1 แต้ม → ทั้งคู่ไปด่านถัดไป. ปุ่ม **ยอมแพ้** = ยกด่านนั้นให้คู่แข่ง (+ อาจจบแมตช์ถ้ากดยอมแพ้ทั้งเกม)
- **D6 — ชื่อ** client-side (localStorage) ส่งตอน join. ไม่มี auth

## 4. Spec

### Worker (`worker/` folder ใหม่ · wrangler.jsonc แยก)
- `worker/src/index.ts` — router: `/ws/room/:code` (WebSocket→MatchRoom), `/api/matchmake` (→Lobby)
- `worker/src/MatchRoom.ts` — DO: onConnect(player,name), onMessage(win/surrender/ready), broadcast state, scoring, advance level, end match
- `worker/src/Lobby.ts` — DO: enqueue, จับคู่, คืน roomCode
- แชร์ generator: import จาก `src/game/generator.ts` (หรือ copy เป็น shared) → seed เดียวกันทั้ง client+worker

### Client (เพิ่ม view)
- หน้าแรก: [เล่นคนเดียว] [ท้าเพื่อน (สร้างลิงก์)] [สุ่มคู่แข่ง] + ช่องตั้งชื่อ
- Match view: กระดานเดียวกับ solo + แถบคะแนน (เรา vs คู่แข่ง) + ด่าน N/10 + ปุ่มยอมแพ้ + สถานะคู่แข่ง (กำลังเล่น/ชนะแล้ว)
- WebSocket client: connect, ส่ง win/surrender, รับ state broadcast
- ลิงก์ challenge: copy `<origin>/?room=<code>`

### Contract (WebSocket messages)
```
C→S: {t:'join', name} · {t:'win', level} · {t:'surrender'} · {t:'ready'}
S→C: {t:'state', players:[{name,score}], level, phase} · {t:'levelWon', winner, scores}
     · {t:'matchEnd', winner, scores} · {t:'opponentLeft'}
```

## 5. Acceptance Criteria
- [ ] AC1: worker build + `wrangler deploy` ผ่าน (DO migration ตั้งค่าถูก)
- [ ] AC2: ตั้งชื่อ → สร้างลิงก์ท้า → เปิดลิงก์อีก tab เข้าห้องเดียวกัน 2 คน
- [ ] AC3: ทั้งคู่เห็นด่านเดียวกัน (seed sync), ลากครบก่อน = ได้แต้ม, ไปด่านถัดไปพร้อมกัน
- [ ] AC4: ครบ 10 ด่าน → สรุปผู้ชนะ (คะแนนรวม)
- [ ] AC5: ปุ่มยอมแพ้ทำงาน (ยกด่าน/จบแมตช์)
- [ ] AC6: สุ่มจับคู่ — 2 คนกด "สุ่ม" → เข้าห้องเดียวกันอัตโนมัติ
- [ ] AC7: solo เดิมยังเล่นได้ (ไม่พัง)
- [ ] AC8: อยู่ใน free tier (WebSocket hibernation, SQLite DO)
- [ ] AC9: คู่แข่งหลุด → แจ้ง + จบ/รอ

## 6. As-built (2026-07-15)
> IMPLEMENTED (worktree `perf-and-v3`) — verified local (wrangler dev + Playwright 2 แท็บ)

### Worker (`worker/`)
- `wrangler.jsonc` — DO bindings `MATCH_ROOM`, `LOBBY`; migration `v1` = `new_sqlite_classes` (free tier)
- `src/index.ts` — router: `/ws/room/:code`, `/ws/lobby`, `/health`, CORS
- `src/MatchRoom.ts` — 1 DO/แมตช์. lifecycle: `waiting → playing → roundEnd (รอ ready ทั้งคู่ หรือ alarm 6s) → advance → … → ended`. WebSocket hibernation (`acceptWebSocket` + `serializeAttachment` slot). server-authoritative win/surrender. reclaim slot ตามชื่อถ้าหลุด
- `src/Lobby.ts` — global DO queue: 2 คน `queue` → mint roomCode → `matched` แล้วปิด lobby socket
- **ไม่ต้อง reuse generator ใน worker** — worker นับแต้มอย่างเดียว, board สร้างที่ client จาก `MATCH_LEVEL_IDS` (seed sync ทั้งคู่)

### Client
- `src/net/mp.ts` — `MatchClient` + `matchmake()`
- `src/net/config.ts` — `MP_WS_BASE` (dev `ws://localhost:8787` · prod `VITE_MP_WS_BASE` · `?mp=` override) · `MP_ENABLED`
- `src/game/match.ts` — `MATCH_LEVEL_IDS=[2,9,18,28,40,52,64,76,88,100]`, nickname (localStorage), roomCode, challengeLink
- `src/game/home.ts` — หน้าแรก + 3 โหมด + join CTA จากลิงก์
- `src/game/matchview.ts` — reuse `renderGame` board + HUD (คะแนน/รอบ/สถานะ/ยอมแพ้/ออก) + overlay round/match
- `input.ts` `suppressWinOverlay`; `levelselect.ts` ปุ่มหน้าหลัก; `main.ts` routing + `?room` join

### AC status
- AC1 ✅ `wrangler deploy --dry-run` ผ่าน (**deploy จริงรอ Cloudflare login**)
- AC2 ✅ · AC3 ✅ (verified 2 แท็บ: seed ตรงกัน, ชนะได้แต้ม, ไปด่านถัดไปพร้อมกัน)
- AC4 ✅ · AC5 ✅ (worker test: surrender + matchEnd 6-4) · AC6 ✅ (lobby pairing test)
- AC7 ✅ solo ยังเล่นได้ · AC8 ✅ SQLite DO + hibernation · AC9 ✅ opponentLeft broadcast

### เหลือ (deploy)
1. `cd worker && wrangler login && npm run deploy` → ได้ URL เช่น `puzzle-path-mp.<sub>.workers.dev`
2. ตั้ง `VITE_MP_WS_BASE=wss://puzzle-path-mp.<sub>.workers.dev` (`.env.production`) แล้ว `npm run build`
3. `wrangler pages deploy dist` (frontend เดิม)
