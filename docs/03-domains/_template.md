# <ชื่อ module/feature> — DESIGN | IMPLEMENTED
> สถานะ + วันที่ (+ commit hash เมื่อเสร็จ) · owner (repo ไหน) · ลิงก์ doc ที่เกี่ยว [[...]]
> **Out of scope:** อะไรที่งานนี้ห้ามแตะ (❗ implementer ที่ไม่เห็น chat เช่น Codex เดาขอบเขตเองไม่ได้)

## 1. ทำไม (why + constraint)
เหตุผล + ข้อจำกัด. requirement เปลี่ยน → เขียน `🔄 UPDATE <วันที่>` ทับ ไม่ลบของเดิม.

## 2. Foundation ที่มีอยู่แล้ว ❗ ห้ามสร้างซ้ำ
อ้างไฟล์/function จริงที่ต้อง reuse — ไม่เขียนจากความจำ.

## 3. Decisions (D1, D2 …)
ทางเลือกที่ตัดสินแล้ว + เหตุผลสั้น (ทำไมเลือก/ไม่เลือกทางอื่น).
security decision → ระบุ "advisor-reviewed" + อธิบายว่า naive design พังยังไง.

## 4. Spec (contract — พอ implement ได้โดยไม่ต้องเดา)
endpoint + method + payload + error code · response shape + status (pin ให้ FE/BE ตรงกัน).
**Files ที่จะแตะ:** `path` — สร้าง/แก้ อะไร.

## 5. Acceptance Criteria (verify ได้ทุกข้อ)
- [ ] AC1: given `<input>` → expect `<output>`
- [ ] AC2: given `<edge case>` → `<behavior>`
- [ ] AC3: test/build/lint ผ่าน
- [ ] AC4: ไม่แตะไฟล์นอก Out of scope

## 6. Flow สรุป
ลำดับ 1-2-3-4 อ่านจบใน 30 วินาที.

## 7. As-built (เติมหลัง implement)
> IMPLEMENTED <วันที่> · commit `<hash>`
- ผล verify จริง (AC ผ่านกี่ข้อ / test output)
- ⚠️ Gotcha ที่เจอตอนทำจริง
- ⚠️ Residual ที่ปิดไม่ได้ + เหตุผล — เขียนตรงๆ ไม่ซุก
