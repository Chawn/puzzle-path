# docs — Puzzle Path

`docs/` = ศูนย์กลางการพัฒนา **docs นำ code เสมอ** (ดู `docs-first-development` skill)
เปิด repo → อ่าน `CLAUDE.md` → ชี้มาที่นี่. ทุก feature เขียน design ก่อน implement, จบแล้วอัปเดตเป็น as-built.

## Folder map (00–13) — convention กลาง

★ = สร้างเลย (Standard default) · ที่เหลือ = **สร้างตอนเริ่มมี feature ที่ต้องใช้** (ไม่ต้องมีโฟลเดอร์เปล่ารอ)
เลข/ชื่อ fix ตาม map นี้ → ทุกคน (คน+Claude) รู้ว่าอะไรอยู่ไหน โดยไม่ต้องเดา

| # | folder | ใส่อะไร | |
|---|---|---|---|
| 00 | `00-overview` | overview + roadmap (สถานะรวม) | ★ |
| 01 | `01-requirements` | TOR / spec / user stories | |
| 02 | `02-architecture` | โครงระบบ + diagram | ★ |
| 03 | `03-domains` | design doc ต่อ feature (หัวใจ · `_template.md`) | ★ |
| 04 | `04-api` | API contract / conventions | |
| 05 | `05-frontend` | FE standard / component / design-system | |
| 06 | `06-testing` | test strategy / E2E | |
| 07 | `07-deployment` | deploy / runbook / infra | |
| 08 | `08-operations` | monitoring / incident / on-call | |
| 09 | `09-adr` | architecture decision records (`_template.md`) | ★ |
| 10 | `10-changelog` | CHANGELOG | ★ |
| 11 | `11-agents` | กฎ Claude / agent ต่อ repo | |
| 12 | `12-workflow` | วิธีทำงาน (docs-first, git flow) | ★ |
| 13 | `13-reference` | glossary / external link / cheat-sheet | |

**Full (multi-repo/product):** สร้าง physical ครบตั้งแต่แรกได้เลย ถ้ารู้ว่าจะใช้

## กติกา
- Title design doc บอกสถานะ: `— DESIGN` → `— IMPLEMENTED` (เปิดโฟลเดอร์รู้เลยอะไรเสร็จ/ยัง)
- Decision อยู่ใน docs ไม่ใช่ code comment/chat
- Residual เขียนตรงๆ ไม่เคลมเสร็จ 100%
