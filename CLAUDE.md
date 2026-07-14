# Puzzle Path

เว็บเกม puzzle: ลากเส้นเดียวผ่านทุกช่องในตาราง (Hamiltonian path) จนครบ = ผ่านด่าน. 100 ด่าน ง่าย→ยาก. responsive web/mobile/tablet.

## docs-first
`docs/` = ศูนย์กลาง อ่านก่อนแก้เสมอ. Authoritative design: `docs/03-domains/game-mechanic.md`.
วิธีทำงาน: `docs/12-workflow/`.

## Stack
Vanilla TS + Vite · DOM grid · pointer events (mouse+touch) · CSS grid responsive · localStorage เก็บ progress.

## Dev
`npm install && npm run dev` · build: `npm run build` (tsc + vite) · typecheck: `npm run typecheck`
