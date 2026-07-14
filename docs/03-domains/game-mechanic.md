# Game Mechanic — Puzzle Path — IMPLEMENTED
> IMPLEMENTED 2026-07-15 · owner: puzzle-path (single repo) · stack: Vanilla TS + Vite
> **Out of scope:** backend/API · บัญชีผู้ใช้/login · เสียง/เพลง · animation หรูๆ (เอาแค่ highlight พอ) · level editor UI · multiplayer · leaderboard ออนไลน์ · framework (React/Vue) — ห้ามเพิ่ม dependency นอกจาก vite+typescript

## 1. ทำไม (why + constraint)
เว็บเกม puzzle 100 ด่าน: ลากเส้นเดียวต่อเนื่องผ่าน "ทุกช่องที่ไม่บล็อก" ในตาราง จนครบ = ผ่านด่าน (Hamiltonian path). ง่าย→ยากขึ้นเรื่อยๆ. ต้อง responsive เล่นได้ web/mobile/tablet (นิ้ว + เมาส์). ได้ไอเดียจากเกมใน Roblox.
Constraint: static site ล้วน (ไม่มี backend) deploy Cloudflare Pages ได้ · dependency แค่ vite + typescript.

## 2. Foundation ที่มีอยู่แล้ว ❗ ห้ามสร้างซ้ำ
Base scaffold มีแล้ว (ห้ามเขียนทับ config พวกนี้):
- `package.json` — scripts: dev/build/preview/typecheck · deps: vite ^6, typescript ^5.6
- `tsconfig.json` — strict, noUnusedLocals/Parameters เปิด (โค้ดต้องสะอาด)
- `vite.config.ts` — `base: './'` (สำคัญ: relative path ให้ deploy subpath ได้)
- `index.html` — `<div id="app"></div>` + `<script src="/src/main.ts">` · viewport lock (maximum-scale=1, user-scalable=no กัน zoom ตอนลาก)
Codex ต้องสร้างเฉพาะไฟล์ใน `src/` (ดู §4 Files).

## 3. Decisions
- **D1 — Mechanic: Fill-all (Hamiltonian path) + walls.** เริ่มจากช่อง Start ที่กำหนด (marker `S`) ลากไปช่องที่ติดกัน 4 ทิศ (บน/ล่าง/ซ้าย/ขวา) ที่ยังไม่เดินและไม่บล็อก. ครบทุกช่องที่ไม่บล็อก = ชนะ. ไม่มีเลขลำดับ (ไม่ใช่ Zip). ความยากมาจากขนาด grid + จำนวนช่องบล็อก.
- **D2 — Stack: Vanilla TS + Vite, DOM grid** (ไม่ใช่ canvas — DOM ทำ responsive + hit-test ง่ายกว่าสำหรับ grid). CSS Grid layout.
- **D3 — Procedural generation ต่อ level, guaranteed-solvable.** สร้างด่านจาก seed = level id (deterministic — เปิดด่านเดิมได้ puzzle เดิม). วิธีการันตีว่าแก้ได้: **สุ่ม Hamiltonian path ก่อน** แล้วค่อยกำหนดช่องบล็อกจากช่องที่ path ไม่ผ่าน → puzzle มีทางแก้แน่นอนโดย construction (ดู §4 generator).
- **D4 — Difficulty curve** ตาม level (ดู §4 formula): เริ่ม 3×3 ไม่มีกำแพง → โตขึ้นจน ~8×8+ มีกำแพง. 100 ด่าน.
- **D5 — Input: Pointer Events** (`pointerdown/move/up`) — mouse + touch รวมโค้ดเดียว. ลากถอยกลับช่องก่อนหน้า = undo ช่องล่าสุด.
- **D6 — Progress: localStorage** — เก็บ level สูงสุดที่ปลดล็อก + level ปัจจุบัน. reload แล้วเล่นต่อได้.

## 4. Spec

### Data model
```ts
type Cell = { r: number; c: number }          // แถว, คอลัมน์
type Level = {
  id: number                                   // 1..100
  rows: number; cols: number
  blocked: boolean[][]                          // [r][c] true = กำแพง
  start: Cell                                   // จุดเริ่ม (marker S)
  totalPlayable: number                         // จำนวนช่องที่ต้องเดินให้ครบ (= rows*cols - จำนวน blocked)
}
```

### Generator (`src/game/generator.ts`) — ต้อง deterministic + solvable
- ใช้ seeded PRNG (เช่น mulberry32) seed = level.id → ด่านเดิม puzzle เดิม
- ขั้นตอน:
  1. คำนวณ rows/cols + จำนวนกำแพงเป้าหมายจาก level id (§ difficulty)
  2. สุ่ม Hamiltonian path บน grid เต็มด้วย randomized DFS/backtracking บนช่องที่ "จะให้เดินได้"
  3. ช่องที่ path ไม่ผ่าน = กำแพง (blocked) → การันตีว่าช่อง playable ทั้งหมดต่อกันเป็น path เดียวได้จริง
  4. start = ปลายด้านหนึ่งของ path
- ❗ ต้อง verify: ทุก level 1..100 generate แล้วมี solution (มีเทสต์/assert ว่า path ครบ totalPlayable)

### Difficulty curve (formula ใน generator)
- band ตาม level (ปรับได้ แต่ต้องไล่ระดับชัด):
  - lvl 1–10: 3×3 → 4×4, กำแพง 0
  - lvl 11–30: 5×5, กำแพงน้อย (0–3)
  - lvl 31–60: 6×6, กำแพงปานกลาง
  - lvl 61–90: 7×7, กำแพงมากขึ้น
  - lvl 91–100: 8×8+, กำแพงเยอะ
- ต้องเป็น monotonic คร่าวๆ (ยากขึ้นตาม level) — ไม่ต้องเป๊ะทุกด่านแต่แนวโน้มชัด

### Game state (`src/game/state.ts`)
- `path: Cell[]` — ลำดับช่องที่เดินแล้ว (เริ่มด้วย start)
- extend(cell): ต่อได้ถ้า cell ติดกับปลาย path (adjacent 4-dir) + ไม่บล็อก + ยังไม่อยู่ใน path
- undo: ถ้าลากกลับไปช่อง path[length-2] → ตัดช่องท้ายออก
- isWin(): path.length === totalPlayable

### Render (`src/game/render.ts`)
- DOM grid (CSS Grid) ใน `#app`: cell = div. class: blocked / start / in-path / head(ช่องปลายปัจจุบัน)
- วาดเส้น path (highlight cell + เชื่อมทิศ) · start marker `S`
- responsive: grid กว้างเท่า min(viewport) จัดกลางจอ · cell size คำนวณจากขนาด grid + viewport (ช่องใหญ่พอแตะด้วยนิ้ว ≥ 32px บนมือถือ)
- แถบบน: "ด่าน N/100" + ปุ่ม Reset · win overlay: "ผ่าน! " + ปุ่ม "ด่านต่อไป"

### Input (`src/game/input.ts`)
- pointerdown บนช่อง start (หรือช่องปลาย path) → เริ่มลาก
- pointermove → หา cell ใต้ pointer (elementFromPoint หรือ data-attr) → extend/undo ตามกติกา
- pointerup → จบลาก · ถ้า isWin → แสดง overlay + ปลดล็อก level ถัดไป
- กัน scroll/zoom ระหว่างลาก (touch-action: none บน grid)

### Entry (`src/main.ts`)
- โหลด progress จาก localStorage → เปิด level ปัจจุบัน → wire render + input + generator
- ปุ่ม "ด่านต่อไป" → level+1 (สูงสุด 100) → save progress

### Files ที่ Codex สร้าง (ใน src/ เท่านั้น)
`src/game/types.ts` · `src/game/prng.ts` · `src/game/generator.ts` · `src/game/state.ts` · `src/game/render.ts` · `src/game/input.ts` · `src/main.ts` · `src/style.css`

## 5. Acceptance Criteria (verify ได้ทุกข้อ)
- [ ] AC1: `npm install && npm run build` ผ่าน (tsc strict + vite) ไม่มี error/warning จาก noUnusedLocals
- [ ] AC2: เปิดแอป → ด่าน 1 เป็น grid เล็ก (3×3) ไม่มีกำแพง มีจุด S
- [ ] AC3: ลากเส้นผ่านครบทุกช่อง (valid Hamiltonian path) → ขึ้น overlay "ผ่าน" + มีปุ่มด่านต่อไป → กดแล้วไปด่าน 2
- [ ] AC4: move ที่ผิดกติกา (ช่องไม่ติดกัน / ช่องบล็อก / ช่องเดินซ้ำ) → ถูกปฏิเสธ ไม่ต่อ path
- [ ] AC5: ลากถอยกลับช่องก่อนหน้า → undo ช่องล่าสุด (path สั้นลง)
- [ ] AC6: responsive — ที่ความกว้าง 375px (มือถือ) grid พอดีจอ ไม่ overflow, ลากด้วย touch ได้ (pointer events); ที่ desktop/tablet ก็จัดกลางพอดี
- [ ] AC7: progress เก็บใน localStorage — reload แล้วยังอยู่ด่านเดิม + ด่านที่ปลดล็อกไม่หาย
- [ ] AC8: มีครบ 100 ด่าน, ความยากไล่ระดับ (grid/กำแพงโตตาม level)
- [ ] AC9: **ทุกด่าน 1..100 generate แล้วแก้ได้จริง** (การันตีโดย construction; มี assert/log ยืนยัน path ครบ totalPlayable)
- [ ] AC10: ไม่แตะ Out of scope (ไม่มี backend, ไม่เพิ่ม dependency นอก vite+typescript, ไม่แก้ config ใน §2)

## 6. Flow สรุป
โหลด progress → generator(levelId) สร้างด่าน (solvable) → render grid → ผู้เล่นลาก (input) → state ตรวจกติกา → ครบทุกช่อง → win overlay → ด่านต่อไป → save.

## 7. As-built
> IMPLEMENTED 2026-07-15 · branch `feat/game-implementation` · Codex implement + Claude review/verify
> Codex สร้าง 8 ไฟล์ใน src/ (873 บรรทัด) ตาม §4 ไม่แตะ config/docs

### ผล verify จริง (Claude รันเอง ไม่เชื่อ Codex ล้วน)
- **AC1** ✅ `npm run build` ผ่าน (tsc strict + vite, 0 error) — รันอิสระ
- **AC2** ✅ ด่าน 1 = 3×3 ไม่มีกำแพง มี start (verify ผ่าน Playwright: start (0,2))
- **AC3** ✅ drive drag ครบ 9 ช่อง → win text ขึ้น + progress เลื่อน `unlockedLevel:2` (end-to-end Playwright)
- **AC4/5** ✅ review state.ts: reject blocked/in-path/non-adjacent + undo (cell==previous→pop)
- **AC6** ✅ 375px: ไม่มี horizontal overflow (scrollWidth=375), grid 360×360 พอดีจอ, cell 113px, `touch-action:none`
- **AC7** ✅ progress เก็บ localStorage (observed `{"currentLevel":1,"unlockedLevel":2}`)
- **AC8** ✅ getDifficulty band 3×3→8×8+ กำแพงโตตาม level
- **AC9** ✅ runtime log "verified 100 deterministic solvable levels" + review assertSolvable เป็น check จริง (continuous/no-wall/no-repeat/ครบ) ไม่ใช่ no-op. การันตี by construction (blocked = ช่องที่ path ไม่ผ่าน)
- **AC10** ✅ git status: แตะแค่ src/ + package-lock, ไม่แตะ config/docs, ไม่เพิ่ม dependency

### ⚠️ Residual (เขียนตรงๆ ไม่เคลม 100%)
- ✅ FIXED: `assertAllLevelsSolvable()` gate `import.meta.env.DEV` แล้ว (tree-shake จาก prod, per-level assert ยังอยู่)
- ✅ FIXED: favicon inline SVG (grid/เส้น) กัน 404
- ยังไม่ได้ deploy (Cloudflare Pages) — out of scope รอบนี้

---
## 🔄 UPDATE 2026-07-15 — v2 (ธีมหินบนลาวา · board หลากหลาย · เลือกด่าน · win animation)

> requirement เพิ่ม ไม่ลบของเดิม — v1 mechanic คงเดิม (Hamiltonian fill-all + solvable by construction)

### Decisions v2
- **D7 — ธีมหินบนลาวา (visual overhaul).** ช่องบล็อก = **ลาวา** (ไม่ใช่ "กำแพง"), ช่องเล่นได้ = **แผ่นหิน**. path = ทางเรืองแสง (molten trail). พื้นหลังลาวาไล่สี+glow เคลื่อนไหว (CSS animation). โทน: ลาวาแดง-ส้ม-ดำ + หินเทา + path เรืองแสงทอง/ส้มสว่าง. ให้ดู "จริงจัง" มีมิติ (shadow, gradient, texture ด้วย CSS ล้วน — ห้ามใช้รูปภายนอก).
- **D8 — Board หลากหลาย ไม่จตุรัสทุกด่าน.** vary bounding box (rows≠cols เช่น 4×6, 3×7, 6×5) + vary สัดส่วนลาวา → playable region เป็นรูปไม่สม่ำเสมอ มีเว้า/แขนยื่น ต่างกันทุกด่าน (seed=levelId).
  - ❗ **ข้อจำกัดตามจริง:** playable region ต้องต่อกันเป็น path เดียว → **ไม่มี island แยกขาดจริง** (จะแก้ไม่ได้). "ส่วนแยก" = แขนเว้า/คอคอด/รูปตัว L,T,U ไม่ใช่เกาะลอย. เขียนไว้ตรงๆ กันเข้าใจผิด.
- **D9 — ยากขึ้น.** เพิ่มความหนาแน่นลาวา + grid โตเร็วขึ้น + รูปเว้าซับซ้อนตั้งแต่ช่วงกลาง (ปรับ getDifficulty).
- **D10 — หน้าเลือกด่าน.** grid ปุ่ม 1..100: ด่านปลดล็อก = หิน (คลิกเล่นได้) · ล็อก = ลาวา/มืด (คลิกไม่ได้). เข้าเกม→มีปุ่มกลับหน้าเลือก. current/unlocked จาก localStorage เดิม.
- **D11 — Win animation.** ชนะ → หินบน path ไล่สว่างทีละช่องตามลำดับ + glow/particle burst + ข้อความ "ผ่าน!" animate → ปุ่มด่านต่อไป. (CSS/canvas ล้วน ไม่เพิ่ม lib)

### Spec เพิ่ม
- `getDifficulty`: คืน rows/cols ที่ไม่จำเป็นต้องเท่ากัน + walls(ลาวา) เยอะขึ้น. band ปรับยากขึ้น
- generator: เดิม (สุ่ม Hamiltonian path → non-path = lava) ยังการันตี solvable — แค่ param หลากหลายขึ้น
- render: 2 view — **level-select** + **game**. state จัดการ view ปัจจุบัน
- ไฟล์ใหม่ที่อาจเพิ่ม (ใน src/ เท่านั้น): `src/game/levelselect.ts` (หรือรวมใน render), `src/game/anim.ts` (win animation) — Codex เลือกโครงได้ตามเหมาะสม
- **Out of scope (คงเดิม):** backend · บัญชี · **เสียง** · dependency นอก vite+typescript · รูปภาพภายนอก (ใช้ CSS/SVG/canvas gen เอง)

### Acceptance Criteria v2 (เพิ่มจาก AC1-10)
- [ ] AC11: board ไม่เป็นจตุรัสทุกด่าน — dimensions + รูป playable ต่างกันตาม level (เว้า/แขน) ไม่ซ้ำแบบเดิมตลอด
- [ ] AC12: ธีมหินบนลาวา — พื้นลาวา animated glow, หินมีมิติ, path เรืองแสง; ดูจริงจัง (ไม่ใช่ตารางเปล่า)
- [ ] AC13: หน้าเลือกด่าน — แสดง 1..100, locked/unlocked ต่างชัด, คลิกด่านปลดล็อกเข้าเล่นได้, มีปุ่มกลับ
- [ ] AC14: win animation เล่นตอนชนะ (path ไล่สว่าง/glow) ก่อนปุ่มด่านต่อไป
- [ ] AC15: ยากขึ้นกว่า v1 (ลาวาหนาแน่น/grid โตกว่า)
- [ ] AC16: ทุกด่าน 1..100 ยัง solvable (by construction + assert) · `npm run build` ผ่าน · ไม่เพิ่ม dependency · ไม่แตะ backend/docs
