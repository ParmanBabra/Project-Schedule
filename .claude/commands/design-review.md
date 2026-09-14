---
description: ถ่ายภาพหน้าจอจริงทุกหน้า เทียบกับ mockup และ design system แล้วแก้จนตรง
---

ทำ design review รอบหนึ่งให้ครบวงจร ห้ามข้ามขั้น

1. ตรวจว่า artboard ใน `design/*.dc.html` มีอยู่ ถ้าไม่มีให้รัน `cd design && node build-layouts.mjs && node build-mobile.mjs && node build-settings.mjs`
2. รัน `cd frontend && npm run shots` เพื่อถ่ายภาพแอปจริงทุกหน้าใน `frontend/shots/screens.ts` ทั้ง desktop และ mobile และ render mockup ลง `frontend/.screenshots/`
3. เปิดดูภาพทีละคู่ด้วยเครื่องมือ Read: `.screenshots/app/<viewport>/<screen>.png` เทียบกับ `.screenshots/mockups/<mockup>.png` ที่ระบุใน registry และเทียบกับกติกาใน `docs/design-system.md` และ `docs/ui-design.md`
4. เขียนรายการสิ่งที่ต้องแก้เป็นตาราง: หน้า / viewport / จุดที่ต่าง / token หรือกติกาที่อ้างอิง / ความสำคัญ (สูง = ใช้งานผิด อ่านไม่ออก แตะไม่ได้, กลาง = ต่างจาก mockup ชัดเจน, ต่ำ = ปรับละเอียด) เช็กอย่างน้อย: สี ระยะห่าง ขนาดตัวอักษร มุมโค้ง เงา ขนาดพื้นที่แตะ >= 44px บนมือถือ ข้อความล้นหรือถูกตัด ลำดับสายตา สถานะว่าง
5. แก้โค้ดตามรายการ ใช้ token จาก `tokens.css` เท่านั้น แล้วรัน `npm run shots` ใหม่ เปิดภาพซ้ำ วนจนรายการเหลือเฉพาะข้อที่ต้องให้ผู้ใช้ตัดสินใจ
6. รัน `npm test` และ `npm run test:e2e` ให้เขียว
7. รายงานผู้ใช้: ตารางก่อน/หลัง (path ของภาพก่อนและหลัง) สิ่งที่แก้ สิ่งที่ยังเหลือและเหตุผล และถามว่าจะล็อก baseline ด้วย `/design-approve` หรือไม่

ถ้า screen ใหม่ยังไม่อยู่ใน `frontend/shots/screens.ts` ให้เพิ่มก่อนเริ่มข้อ 2 พร้อมระบุ mockup ที่คู่กัน
