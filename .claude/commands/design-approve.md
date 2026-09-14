---
description: ล็อกหน้าตาปัจจุบันเป็น baseline สำหรับ visual regression test
---

ล็อก baseline ของ visual regression หลังผู้ใช้พอใจผล design review แล้ว

1. ยืนยันว่า `npm test` และ `npm run test:e2e` เขียว และไม่มีรายการระดับสูงค้างจาก design review ล่าสุด ถ้ามีให้หยุดและบอกผู้ใช้
2. รัน `cd frontend && npm run visual:approve` เพื่อสร้างหรืออัปเดตภาพใน `frontend/e2e/visual.spec.ts-snapshots/`
3. รัน `npm run test:visual` ยืนยันว่าเขียวกับ baseline ใหม่
4. แสดงรายชื่อไฟล์ snapshot ที่เปลี่ยน (git status) และสรุปว่าหน้าไหนถูกล็อกใหม่ ไม่ commit เว้นแต่ผู้ใช้สั่ง
