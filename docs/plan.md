# แผนการพัฒนา – แผนงาน (Project Scheduler)

วางแผนด้วยกติกาเดียวกับที่ระบบจะใช้: ประเมินเวลาแต่ละงานแบบ "ถ้าราบรื่นจะเสร็จใน" ไม่เผื่อ แล้วรวม buffer ไว้ท้ายโครงการ 50% ตาม Critical Chain

## 1. สมมติฐาน

| หัวข้อ | ค่า |
|---|---|
| ผู้พัฒนา | 1 คน เต็มเวลา ทำงานเรียงลำดับ (ทุกงานอยู่บน critical chain) |
| วันทำงาน | จ – ศ ข้ามวันหยุดราชการ 13 ต.ค., 23 ต.ค., 7 ธ.ค. (ชดเชย), 10 ธ.ค., 31 ธ.ค. |
| เริ่ม | อังคาร 15 ก.ย. 2569 |
| หน่วย | วันทำงาน (วท.) |
| Definition of done ต่อ phase | ใช้งานได้จริงผ่าน UI หรือ API, มี automated test ครบ (pytest / vitest / playwright), งานที่แตะ UI ผ่าน design review ด้วยภาพหน้าจอจริงและ visual regression เขียว, อัปเดต docs ถ้าเบี่ยงจากที่ออกแบบ |

## 1.1 Flow การทำงานต่อหนึ่งงาน

```
อ่าน docs ที่เกี่ยวข้อง → เขียน test ที่ล้มเหลว → เขียนโค้ดให้ผ่าน → npm test
   → (ถ้าแตะ UI) ลงทะเบียนหน้าใน shots/screens.ts → /design-review
   → แก้จนภาพตรง mockup → npm run test:e2e + test:visual เขียว
   → รายงานผล (ตาราง test + ภาพก่อน/หลัง) → ผู้ใช้ตรวจ → /design-approve → commit เมื่อสั่ง
```

Design review เป็นส่วนหนึ่งของงาน ไม่ใช่ขั้นตอนแยกท้าย phase เวลาที่ประเมินไว้ในแต่ละงาน UI รวมการ review 1 ถึง 2 รอบแล้ว

## 2. ภาพรวม

| Phase | เนื้อหา | วท. | เริ่ม | เสร็จ | Milestone |
|---|---|---|---|---|---|
| 0 | ตั้งโครงโปรเจกต์ | 1 | 15 ก.ย. | 15 ก.ย. | รันได้ทั้งสองฝั่ง |
| 1 | Backend core + scheduling engine | 10 | 16 ก.ย. | 29 ก.ย. | **M1** API ครบ CPM ถูกต้อง |
| 2 | Frontend core: shell, Gantt, แผงงาน, ตั้งค่า | 13 | 30 ก.ย. | 19 ต.ค. | **M2** ดูและแก้แผนผ่าน Gantt ได้ |
| 3 | Gantt ลาก + undo/redo | 4 | 20 ต.ค. | 26 ต.ค. | **M3** วางแผนด้วยเมาส์ได้ |
| 4 | Resources + assignments + เกินกำลัง | 5 | 27 ต.ค. | 2 พ.ย. | **M4** มอบหมายงานได้ |
| 5 | Calendar + ติดตาม buffer | 4 | 3 พ.ย. | 6 พ.ย. | **M5** ครบมุมมองหลัก |
| 6 | มือถือ | 4 | 9 พ.ย. | 12 พ.ย. | **M6** ใช้บนมือถือได้ |
| 7 | Import/Export + QA | 5 | 13 พ.ย. | 19 พ.ย. | **M7 เสร็จตามแผน** |
| — | Project buffer 50% | 23 | 20 พ.ย. | 24 ธ.ค. | **สัญญาส่ง 24 ธ.ค. 2569** |

รวมงาน 46 วท. + buffer 23 วท. = 69 วท. ประมาณ 14 สัปดาห์ปฏิทิน

วันที่ควรใช้สื่อสารกับคนอื่นคือ **24 ธ.ค.** ไม่ใช่ 19 พ.ย. ส่วนเป้าภายในคือ 19 พ.ย.

## 3. รายละเอียดแต่ละ Phase

### Phase 0 – ตั้งโครงโปรเจกต์ (1 วท. · 15 ก.ย.)

- [x] โครง folder: `backend/app/{core,features}`, `frontend/src/{app,features,shared}`, `data/`, `docs/`
- [x] Backend: FastAPI + uvicorn, pydantic v2, pytest, ruff; `GET /api/health`
- [x] Frontend: Vite + React + TypeScript, React Router, TanStack Query, Zustand, oxlint; ย้าย `docs/design/tokens.css` เข้า `frontend/src/shared/styles/`; โหลดฟอนต์ Kanit
- [x] Proxy `/api` จาก Vite ไป backend, script `dev` รันทั้งคู่, VS Code tasks
- [x] เครื่องมือทดสอบครบ 3 ชั้น: pytest (fixture แยก DATA_DIR), Vitest + Testing Library, Playwright desktop + mobile พร้อม smoke test
- [x] git init + .gitignore (ไม่ commit `data/`) และ CLAUDE.md

เสร็จ 14 ก.ย. 2569 (ก่อนกำหนด 1 วัน)

### Phase 1 – Backend core (10 วท. · 16 – 29 ก.ย.)

| # | งาน | วท. | ผลลัพธ์ |
|---|---|---|---|
| 1.1 | core/storage: อ่านเขียน JSON แบบ atomic, file lock, `index.json`, backup 20 ชุด, trash | 1 | เขียนซ้อนกันไม่พัง |
| 1.2 | features/projects: CRUD, duplicate, rules และ buffer default (PRJ-1 ถึง PRJ-5, SET defaults) | 1 | `/api/projects` |
| 1.3 | features/tasks: CRUD, reorder, group, move (parentId), milestone, constraint (TSK-1 ถึง TSK-6, WBS-1, WBS-2, WBS-8, WBS-10) | 2 | ต้นไม้งานถูกต้อง |
| 1.4 | features/dependencies: CRUD 4 ประเภท + lag, ตรวจ cycle, ป้องกันซ้ำ (DEP-1, DEP-3 ถึง DEP-5) | 1 | ปฏิเสธวงจรพร้อมบอกเส้นทาง |
| 1.5 | features/scheduling: ปฏิทินวันทำงาน, forward/backward pass, float, critical, constraint, summary rollup, กระจาย dependency ของ summary, near-critical (SCH-1 ถึง SCH-9, SET-1, SET-5) | 3 | pure module + pytest ครอบคลุม |
| 1.6 | scheduling/buffer: ccpm / percent / pert, management reserve, ปัดวัน, สองวันจบ (SCH-10, BUF-2) | 1 | `schedule.buffer` ในผลลัพธ์ |
| 1.7 | `GET /schedule`, `POST /schedule/preview`, `GET /settings/defaults`, integration test, README วิธีรัน | 1 | **M1** |

จุดเสี่ยง: 1.5 เป็นงานที่ประเมินยากที่สุด ถ้าเกิน 3 วันให้ตัด near-critical และ constraint ไปทำหลัง M2

**ผล: เสร็จ 15 ก.ย. 2569 (M1 ก่อนกำหนด 29 ก.ย.)** ครบทุกข้อ 1.1 ถึง 1.7 รวม near-critical, constraint, summary rollup, buffer 3 วิธี ทดสอบ 66 รายการผ่าน (engine 31, calendar 7, storage 5, API 23) และ performance 500 งานต่ำกว่า 100 ms ข้อที่เบี่ยงจากเอกสารบันทึกไว้ใน features.md ส่วน 6

### Phase 2 – Frontend core (13 วท. · 30 ก.ย. – 19 ต.ค.)

| # | งาน | วท. | ผลลัพธ์ |
|---|---|---|---|
| 2.1 | shared/ui: Button, IconButton, Chip, Pill, Avatar, Input family, Segment, Toggle, Card, Tooltip, Toast, Dialog, EmptyState ตาม design-system.md | 2 | Storybook ไม่ต้อง ใช้หน้า `/dev/ui` แสดงทุก component |
| 2.2 | app/layout: HeaderBar (Layout 2), project switcher, routing, TanStack Query client; features/projects: รายการ + สร้าง + ลบ | 1 | เข้าโปรเจกต์ได้ |
| 2.3 | features/gantt: GanttTimeline หัววัน/สัปดาห์/เดือน, TaskBar, DependencyArrow, WBS ย่อหน้า/ยุบขยาย, summary bar, milestone, float, เส้นวันนี้, zoom (GNT-1 ถึง GNT-5, GNT-9 ถึง GNT-11, GNT-14, WBS-3, WBS-9) | 4 | Gantt แสดงถูกต้องจากข้อมูลจริง |
| 2.4 | features/tasks: TaskPanel, DependencyRow, CpmBox, assignment placeholder, autosave (GNT-13, 3.9) | 2 | แก้งานได้ครบ |
| 2.5 | TaskListDrawer ตารางเต็ม แก้ค่าในตาราง ลากเรียง indent/outdent (GNT-12, TSK-4) | 1 | |
| 2.6 | features/settings: หน้าตั้งค่า การ์ดสำรองเวลา 3 ใบพร้อมตัวอย่างสด, กติกา SET-1, SET-5 ถึง SET-9, dialog สลับ ccpm, วันทำงาน/วันหยุด (BUF-1, PRJ-3) | 2 | |
| 2.7 | แถบ buffer ใน Gantt, ชิปสองวันจบ, ชิป critical, placeholder "ถ้าราบรื่น กี่วัน" (BUF-3, BUF-4) | 1 | **M2** |

**ผล: เสร็จ 15 ก.ย. 2569 (M2 ก่อนกำหนด 19 ต.ค.)** ครบ 2.1 ถึง 2.7 ผ่าน design review ทั้ง desktop และมือถือ มี unit test 31, e2e 12 flow (desktop + mobile) และ visual baseline 18 ภาพ สิ่งที่เบี่ยงจากแผน: drawer ใช้ปุ่มเลื่อนขึ้น/ลง/ย่อหน้าแทนการลากเรียง (การลากไปทำใน Phase 3 พร้อมกับการลากแถบ) และหน้าตั้งค่าใช้ preview จาก API คำนวณตัวอย่างสดของทั้ง 3 วิธี

### Phase 3 – Gantt ลาก + undo (4 วท. · 20 – 26 ต.ค.)

| # | งาน | วท. |
|---|---|---|
| 3.1 | ลากเลื่อนแถบ (สร้าง constraint), ลากขอบปรับ duration, preview ผ่าน `/schedule/preview` แบบ debounce, แสดงงานที่กระทบ (GNT-6, GNT-7, SET-7) | 2 |
| 3.2 | ลากสร้าง dependency จากปลายแถบ, คลิกเส้นเพื่อแก้/ลบ (GNT-8, DEP-2) | 1 |
| 3.3 | Undo/redo snapshot 50 ขั้น + คีย์ลัดทั้งหมดตาม ui-design.md ส่วน 6 (HIS-1) | 1 |

**ผล: เสร็จ 16 ก.ย. 2569 (M3 ก่อนกำหนด 26 ต.ค.)** ลากเลื่อนงาน (สร้าง constraint SNET) ลากขอบปรับระยะเวลา preview ผลกระทบสดผ่าน `/schedule/preview` พร้อมแถบ ghost และเส้นขอบงานที่กระทบ ลากจุดท้ายแถบสร้าง dependency คลิกลูกศรเปิด popover แก้ประเภท/lag/ลบ undo/redo 50 ขั้นผ่าน `PUT /projects/{id}` และคีย์ลัด N 1 2 3 T C Ctrl+Z Ctrl+Shift+Z การลากปิดบนอุปกรณ์สัมผัสตามสเปกมือถือ

### Phase 4 – Resources (5 วท. · 27 ต.ค. – 2 พ.ย.)

| # | งาน | วท. |
|---|---|---|
| 4.1 | backend features/resources + assignments + workload ข้ามโปรเจกต์ + เกณฑ์เกินกำลัง (RES-1 ถึง RES-3, RES-6, ASG-1 ถึง ASG-4, SET-4) | 2 |
| 4.2 | หน้าทรัพยากร: ตาราง, WorkloadBar, WorkloadHeat, การ์ดเตือน, แผงแก้ไข (RES-4, RES-5) | 2 |
| 4.3 | มอบหมายในแผงงาน + เตือนเกินกำลังทันที, คอลัมน์ผู้ทำใน drawer | 1 |

**ผล: เสร็จ 16 ก.ย. 2569 (M4 ก่อนกำหนด 2 พ.ย.)** ทรัพยากรกลาง (CRUD, สี, วันลา, ลบแบบ force เมื่อถูกมอบหมาย) มอบหมายจากแผงงานพร้อม % และคำเตือนเกินกำลังทันที workload รายวันข้ามโปรเจกต์ผ่าน `GET /resources/workload` ใช้เกณฑ์ SET-4 ของโปรเจกต์ หน้าทรัพยากรมีการ์ดเตือนกลุ่มวันติดกัน ปุ่มไปที่งาน แถบภาระสูงสุดและความร้อน 14 วัน ชิป "เกินกำลัง N คน" บน Gantt (นับเฉพาะทรัพยากรของโปรเจกต์) คอลัมน์ผู้ทำใน drawer

### Phase 5 – Calendar + ติดตาม buffer (4 วท. · 3 – 6 พ.ย.)

| # | งาน | วท. |
|---|---|---|
| 5.1 | มุมมองเดือน ชิปทอดข้ามวัน OverloadBadge กรองทรัพยากร (CAL-1, CAL-3, CAL-4, CAL-6, CAL-7) | 2 |
| 5.2 | มุมมองสัปดาห์ตามทรัพยากร + ลากย้ายวัน (CAL-2, CAL-5) | 1 |
| 5.3 | การใช้ buffer เทียบความคืบหน้า สัญญาณ 3 โซน, สถานะล่าช้าแบบ linear, SET-2, SET-3, SET-10 (BUF-5) | 1 |

**ผล: เสร็จ 16 ก.ย. 2569 (M5 ก่อนกำหนด 6 พ.ย.)** ปฏิทินเดือน (ชิปทอดข้ามวัน ตราจำนวนคนเกินกำลังต่อวัน กรองตามทรัพยากร ลากชิปเลื่อนงาน) ปฏิทินสัปดาห์ตามทรัพยากร (แถวละคน ช่องเกินกำลังพื้นชมพูพร้อม %) มือถือเป็นรายการวันแนวตั้ง แผงงานเดียวกับ Gantt · baseline บันทึก/ล้างได้จาก Gantt และตั้งค่า ล็อกขนาดและตำแหน่ง buffer ไว้ที่ baseline วัดการใช้ buffer เทียบความคืบหน้าของสายงานหลักเป็นสัญญาณ เขียว/เหลือง/แดง ตามโซน SET-10 ที่ปรับได้ · สถานะงานล่าช้า 3 วิธี (SET-3) พร้อมป้าย "ล่าช้า" และชิปนับ

### Phase 6 – มือถือ (4 วท. · 9 – 12 พ.ย.)

| # | งาน | วท. |
|---|---|---|
| 6.1 | BottomNav, header มือถือ, breakpoint tokens, ProjectList 1 คอลัมน์ | 1 |
| 6.2 | Gantt มือถือ: คอลัมน์ 120px เลื่อนนิ้ว ปิดการลาก ปุ่มวันนี้ลอย | 1 |
| 6.3 | BottomSheet component + TaskPanel ในโหมด sheet + settings มือถือ | 1 |
| 6.4 | ปฏิทินมือถือแบบรายวันตามทรัพยากร + ทรัพยากรแบบการ์ด | 1 |

**ผล: เสร็จ 17 ก.ย. 2569 (M6 ก่อนกำหนด 12 พ.ย.)** BottomNav 64px + safe-area (Gantt · ปฏิทิน · ปุ่ม + นูน · ทรัพยากร · โปรเจกต์) แทน FAB บนมือถือ ปุ่ม + เปิดกล่องเพิ่มงานจากทุกหน้าโดยพาไป Gantt ก่อน · Gantt มือถือไม่มีซูมรายวัน (บังคับสัปดาห์) ปุ่ม "วันนี้" ลอยเหนือ BottomNav แถบเครื่องมือย่อเหลือแถวเดียว · ปฏิทินมือถือปัดซ้าย/ขวาเปลี่ยนสัปดาห์ · TaskPanel เป็น sheet 85vh, ตั้งค่า/ทรัพยากร/โปรเจกต์เป็นคอลัมน์เดียวมาตั้งแต่เฟสก่อน (ตรวจซ้ำจากภาพหน้าจอ) · ทดสอบ: vitest BottomNav, e2e มือถือ (Pixel 7) 1 ชุด, visual baseline มือถือ 11 ภาพ

### Phase 7 – Import/Export + QA (5 วท. · 13 – 19 พ.ย.)

| # | งาน | วท. |
|---|---|---|
| 7.1 | Export/Import JSON, Export CSV (IO-1 ถึง IO-3) | 1 |
| 7.2 | Export PNG ของ Gantt (IO-4), BUF-7 เตือนเผื่อซ้ำซ้อน | 1 |
| 7.3 | ทดสอบ end-to-end ด้วยโปรเจกต์จริง 1 ชุด 50+ งาน, วัด performance 500 งาน < 100 ms | 1 |
| 7.4 | แก้บั๊กและเก็บงาน UI ตาม design system, ตรวจ contrast และคีย์บอร์ด | 2 |

**ผล: เสร็จ 17 ก.ย. 2569 (M7 สัญญาส่ง 19 พ.ย. – ส่งก่อนกำหนด)** ส่งออกไฟล์โปรเจกต์ .phaengan.json (สถานะทั้งหมด + ทรัพยากรที่ใช้), ตารางงาน .csv (WBS วันคำนวณ float critical ผู้ทำ งานก่อนหน้า, UTF-8 BOM), ภาพ Gantt .png ตามที่แสดง (html-to-image) จากเมนู "ส่งออก" บน Gantt · นำเข้าจากหน้าโปรเจกต์ จับคู่ทรัพยากรตามชื่อ (ไม่สนช่องว่าง/ตัวพิมพ์) สร้างที่ไม่มีให้ · BUF-7 ชิป "เผื่ออาจซ้ำซ้อน" + คำอธิบายในหน้าตั้งค่า · e2e โปรเจกต์ 60 งาน 6 กลุ่ม (โหลด < 8 วิ, ยุบกลุ่ม, CSV ครบแถว) และ perf 500 งาน < 100 ms ใน pytest · QA: `--text-3` ปรับเป็น #716a91 ให้ผ่าน AA (เดิม 3.56:1) คู่สีอื่นผ่านอยู่แล้ว, e2e คีย์บอร์ด (N/Esc/Tab focus ring/Enter/Ctrl+Z) · ทดสอบรวม: pytest 84, vitest 61, e2e 24 ผ่าน (ข้าม 6 รายการที่เฉพาะอีกอุปกรณ์), visual 26 ภาพ

## 4. สิ่งที่ตั้งใจเลื่อนออกไปหลังสัญญาส่ง

Feeding buffer (BUF-6), baseline และ Earned Schedule เต็มรูปแบบ, resource leveling อัตโนมัติ, template โปรเจกต์, dark mode, งานย่อยแบบ checklist

## 5. การติดตามแผนนี้

- ใช้ตัวเองเป็นโปรเจกต์แรกของระบบ: หลัง M2 ให้ป้อนแผนนี้เข้าแอปแล้วติดตามด้วย fever chart ของแอปเอง
- ทุกวันศุกร์ดูว่าใช้ buffer ไปกี่วันเทียบกับ % งานที่เสร็จ ถ้าอยู่โซนแดง (ใช้ buffer เร็วกว่างานคืบหน้าเกิน 20%) ให้ตัดขอบเขตจากรายการในข้อ 4 ก่อน ไม่ขยับวันสัญญาส่ง
- ถ้า M1 เสร็จช้ากว่า 29 ก.ย. เกิน 3 วัน ให้ทบทวนประมาณการทั้งหมดใหม่ เพราะแปลว่าประเมินแบบมีเผื่อไม่พอ ไม่ใช่แค่โชคร้าย
