# Match Random Levels — SPEC

> SPEC 2026-07-15 · โหมดแข่ง (ท้าเพื่อน + สุ่มออนไลน์) ให้ลำดับ 10 ด่านสุ่มต่อห้อง
> แทนลำดับ fixed `MATCH_LEVEL_IDS = [2,9,18,28,40,52,64,76,88,100]` ที่ทุกแมตช์เหมือนกันหมด

## 1. ทำไม
ตอนนี้ทุกแมตช์เล่นด่านชุดเดิม 10 ด่าน → เดาได้/ซ้ำ. ต้องการให้แต่ละห้องสุ่มด่านต่างกัน
แต่ **ทั้ง 2 ผู้เล่นต้องเห็นด่านเดียวกัน** → สุ่มแบบ deterministic จาก `roomCode` (seed ร่วม)

## 2. Out of scope (❗ Codex ห้ามแตะ)
- `worker/` ทั้งโฟลเดอร์ — Worker นับแต้มอย่างเดียว ไม่รู้จัก level id (seed อยู่ฝั่ง client)
- `src/game/generator.ts`, `state.ts`, `render.ts`, `input.ts` — กลไกเกม 1 ด่าน คงเดิม
- `src/game/home.ts`, `src/net/*`, `src/main.ts`, `src/game/levelselect.ts` — routing/UI คงเดิม
- โหมด solo — ห้ามกระทบ
- **แตะแค่ 2 ไฟล์:** `src/game/match.ts` + `src/game/matchview.ts`

## 3. Foundation ที่มีอยู่แล้ว (❗ reuse ห้ามสร้างซ้ำ)
- `src/game/prng.ts` → `createPrng(seed: number): Prng` มี `{ next(), int(maxExclusive), shuffle() }` — mulberry32 deterministic
- `src/game/generator.ts` → `generateLevel(id: number): Level` — id ถูก clamp 1..100, ยากขึ้นตาม id
- `src/game/matchview.ts` → `renderMatch(app, opts)` รับ `opts.room: string` (roomCode) = seed ร่วมของ 2 ผู้เล่น
  - challenge = roomCode มาจากลิงก์ `?room=<code>` · random = Lobby แจก roomCode เดียวกันให้ทั้งคู่

## 4. Decisions
- **D1** — แทน constant `MATCH_LEVEL_IDS` (fixed) ด้วยฟังก์ชัน `matchLevelIds(roomCode: string): number[]`
- **D2 — คงง่าย→ยาก:** band `b` (0..9) → สุ่ม 1 ด่านในช่วงของ band นั้น = `b*10 + 1 + prng.int(10)`
  → ช่วง 1–10, 11–20, …, 91–100 (10 ด่าน ยากขึ้นเรื่อยๆ แต่สุ่มภายใน band)
- **D3 — seed จาก roomCode:** `createPrng(hashRoomCode(roomCode))` → roomCode เดียวกัน = ลำดับเดียวกัน (2 คนเห็นตรงกัน)
- **D4** — `MATCH_TOTAL` คงเป็น `10` (constant)

## 5. Changes

### `src/game/match.ts`
- เพิ่ม `hashRoomCode(code: string): number` — deterministic string→uint32 (เช่น FNV-1a หรือ djb2, คืน `>>> 0`)
- เพิ่ม `matchLevelIds(roomCode: string): number[]` — length 10:
  ```
  const prng = createPrng(hashRoomCode(roomCode));
  return Array.from({ length: 10 }, (_, band) => band * 10 + 1 + prng.int(10));
  ```
- คง `export const MATCH_TOTAL = 10;`
- **ลบ** `export const MATCH_LEVEL_IDS = [...]` (fixed array) และคอมเมนต์ที่อ้างถึงมัน — อัปเดตคอมเมนต์หัวไฟล์ให้ตรงกับ per-room seeding
- ฟังก์ชันเดิมในไฟล์ (`loadNickname`, `saveNickname`, `newRoomCode`, `challengeLink`) คงไว้ครบ

### `src/game/matchview.ts`
- แก้ import: `import { matchLevelIds, MATCH_TOTAL } from "./match";` (เลิก import `MATCH_LEVEL_IDS`)
- ต้นฟังก์ชัน `renderMatch` (หลังบรรทัด `app.innerHTML = "";`): เพิ่ม `const levelIds = matchLevelIds(opts.room);`
- ใน`loadLevel`: เปลี่ยน `generateLevel(MATCH_LEVEL_IDS[levelIndex])` → `generateLevel(levelIds[levelIndex])`
- ส่วนอื่น (HUD, WebSocket, overlay) คงเดิม

## 6. Acceptance Criteria
- **AC1** — given `matchLevelIds("abc123")` → คืน array length 10, ทุกค่าเป็น integer ในช่วง 1..100
- **AC2** — given index `i` (0-based) → `matchLevelIds(x)[i]` อยู่ในช่วง `[i*10+1, i*10+10]` (ครบทั้ง 10 band, ยากขึ้น)
- **AC3** — given roomCode เดียวกัน เรียก `matchLevelIds` 2 ครั้ง → ได้ array เท่ากันทุกตำแหน่ง (deterministic — 2 คนเห็นตรงกัน)
- **AC4** — given roomCode ต่างกัน (เช่น "aaa" vs "bbbbbb") → array ต่างกันอย่างน้อย 1 ตำแหน่ง (สุ่มจริงต่อห้อง)
- **AC5** — `npm run typecheck` และ `npm run build` ผ่าน
- **AC6** — `grep -rn MATCH_LEVEL_IDS src/` ไม่เจอแล้ว (ลบครบ) ; `MATCH_TOTAL` ยังถูกใช้ใน matchview ปกติ
- **AC7** — `git diff --name-only` แตะแค่ `src/game/match.ts`, `src/game/matchview.ts` (+ spec นี้) — ไม่มี `worker/` หรือไฟล์นอก scope

## 7. As-built
> (เติมหลัง implement + verify)
