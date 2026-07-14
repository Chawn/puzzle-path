# 12-workflow — วิธีทำงานร่วมกับ Claude Code

## หลักสำคัญ — docs-first
`docs/` นำหน้าและเป็นปัจจุบันเสมอ: อ่าน docs ก่อนทำ → เขียน design ก่อน implement → จบแล้ว as-built.
รายละเอียด = `docs-first-development` skill (global).

## Loop ต่องาน (5 ขั้น)
1. **READ** docs ที่เกี่ยว (foundation อะไรมีแล้ว ห้ามสร้างซ้ำ)
2. **DESIGN** — เขียน `03-domains/<name>.md` (สถานะ DESIGN) → commit docs ก่อน
3. **IMPLEMENT** ตาม design (branch → MR) — commit อ้าง decision
4. **VERIFY** — test/E2E จริง → เจอ gap → fix + อัปเดต design
5. **AS-BUILT** — design → IMPLEMENTED (hash, ผล verify, gotcha, residual)

## Codex handoff (ถ้าให้ Codex เขียนโค้ด)
design doc มี **Out of scope** + **Acceptance Criteria** → self-contained ให้ Codex อ่านคนเดียวได้.
สั่ง `/spec-to-code <feature>` → Claude เขียน spec → codex exec implement → Claude review → MR draft.

## Git flow (ปรับตามโปรเจค)
- ทุกงาน = branch → MR → merge (ไม่ commit ตรง base)
- commit message เล่า why ไม่ใช่แค่ what
