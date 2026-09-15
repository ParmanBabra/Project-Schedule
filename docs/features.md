# Feature Specification – แผนงาน (Project Scheduler)

เอกสารนี้ระบุ feature ทั้งหมดของระบบ แบ่งตาม feature module ซึ่งตรงกับโครง folder แบบ feature-based ทั้งฝั่ง backend และ frontend

## 1. ข้อสรุปการตัดสินใจ

| หัวข้อ | ตัดสินใจ |
|---|---|
| ผู้ใช้ | คนเดียว ไม่มีระบบ login |
| หน่วยเวลา | ระดับวัน มุมมอง zoom วัน / สัปดาห์ / เดือน |
| วันทำงาน | จันทร์ – ศุกร์ เพิ่มวันหยุดพิเศษต่อโปรเจกต์ได้ |
| Dependency | รองรับ FS / SS / FF / SF พร้อม lag (บวกหรือลบ หน่วยวัน) |
| Resource กับ duration | ไม่กระทบกัน duration คงที่เสมอ |
| การเก็บข้อมูล | ไฟล์ JSON หนึ่งไฟล์ต่อโปรเจกต์ (tasks + dependencies + assignments) และไฟล์ resources กลางหนึ่งไฟล์ใช้ร่วมทุกโปรเจกต์ |
| ภาษา UI | ไทย (ปี พ.ศ. ในการแสดงผล เก็บเป็น ISO 8601 ค.ศ.) |
| Stack | React + TypeScript (Vite) / FastAPI (Python) |

## 2. Data Model

### 2.1 โครงสร้างไฟล์

```
data/
  index.json                 # รายชื่อโปรเจกต์ (id, name, updatedAt)
  resources.json             # ทรัพยากรกลาง
  projects/
    <projectId>.json         # โปรเจกต์หนึ่งไฟล์
```

### 2.2 Project file

```json
{
  "id": "prj_01",
  "name": "ระบบจองห้องประชุม",
  "startDate": "2026-09-14",
  "holidays": ["2026-10-13", "2026-10-23"],
  "workingDays": [1, 2, 3, 4, 5],
  "tasks": [
    {
      "id": "t_01",
      "name": "ออกแบบระบบ",
      "duration": 5,
      "progress": 40,
      "isMilestone": false,
      "constraint": null,
      "color": null,
      "parentId": null,
      "collapsed": false,
      "order": 2
    }
  ],
  "buffer": {
    "method": "ccpm",
    "ccpmRatio": 50,
    "riskLevel": "medium",
    "percent": 15,
    "pertConfidence": 84,
    "days": null,
    "managementReservePercent": 5
  },
  "rules": {
    "nearCriticalFloatDays": 0,
    "progressRollup": "duration",
    "lateDetection": "linear",
    "overallocationThreshold": 100,
    "lagUnit": "working",
    "defaultDependency": { "type": "FS", "lag": 0 },
    "schedulingMode": "auto"
  },
  "dependencies": [
    { "id": "d_01", "from": "t_00", "to": "t_01", "type": "FS", "lag": 0 }
  ],
  "assignments": [
    { "id": "a_01", "taskId": "t_01", "resourceId": "r_01", "units": 100 }
  ],
  "createdAt": "2026-09-14T09:00:00Z",
  "updatedAt": "2026-09-14T09:00:00Z"
}
```

หมายเหตุ

- `startDate` และ `endDate` ของ task **ไม่เก็บลงไฟล์** แต่คำนวณจาก scheduling engine ทุกครั้งที่อ่าน เพื่อไม่ให้ข้อมูลขัดกัน
- `constraint` เป็นค่า optional เช่น `{ "type": "SNET", "date": "2026-09-20" }` (Start No Earlier Than) ใช้เมื่อผู้ใช้ลากงานไปวางวันที่ต้องการทั้งที่ไม่มี dependency บังคับ
- `order` ใช้จัดลำดับแถวในตาราง ไม่เกี่ยวกับลำดับเวลา
- `parentId` ชี้ไปยังงานแม่ (summary task) งานที่มีลูกจะกลายเป็น summary โดยอัตโนมัติ ไม่ต้องมี flag แยก และ `duration` / `progress` ของ summary จะถูกละเลยเพราะคำนวณจากลูก (ดู 3.12)
- `buffer` เก็บการตั้งค่าสำรองเวลาระดับโปรเจกต์ (ดู 3.13) ค่า `days` เป็น override เมื่อผู้ใช้ระบุจำนวนวันเอง ถ้าเป็น `null` ระบบคำนวณจาก `method`
- `rules` เก็บกติกาการคำนวณที่ผู้ใช้ปรับได้ต่อโปรเจกต์ (ดู 3.14) ทุกค่ามี default ระบบ โปรเจกต์ใหม่คัดลอกจาก default ปัจจุบัน

### 2.3 Resources file

```json
{
  "resources": [
    {
      "id": "r_01",
      "name": "สมชาย",
      "type": "person",
      "capacityPerDay": 100,
      "color": "#6a4fd8",
      "daysOff": ["2026-09-25"]
    },
    { "id": "r_04", "name": "Server A", "type": "equipment", "capacityPerDay": 100, "color": "#8a83a8", "daysOff": [] }
  ]
}
```

## 3. Feature Modules

แต่ละ module มี folder ของตัวเองใน `backend/app/features/<module>` และ `frontend/src/features/<module>`

### 3.1 projects – จัดการโปรเจกต์

| ID | Feature | รายละเอียด |
|---|---|---|
| PRJ-1 | สร้างโปรเจกต์ | ระบุชื่อ วันเริ่ม สร้างไฟล์ใหม่และเพิ่มใน index |
| PRJ-2 | รายการโปรเจกต์ | แสดงชื่อ วันเริ่ม กำหนดเสร็จ (คำนวณ) ความคืบหน้ารวม จำนวนงาน จำนวน critical task |
| PRJ-3 | แก้ไขโปรเจกต์ | เปลี่ยนชื่อ วันเริ่ม วันทำงาน วันหยุด |
| PRJ-4 | ลบโปรเจกต์ | ยืนยันก่อนลบ ย้ายไฟล์ไป `data/trash/` แทนลบจริง |
| PRJ-5 | ทำสำเนาโปรเจกต์ | copy ไฟล์พร้อม id ใหม่ |
| PRJ-6 | สลับโปรเจกต์ | project switcher บน header bar |

API

```
GET    /api/projects
POST   /api/projects
GET    /api/projects/{id}          # คืนโปรเจกต์พร้อม schedule ที่คำนวณแล้ว
PATCH  /api/projects/{id}
DELETE /api/projects/{id}
POST   /api/projects/{id}/duplicate
```

### 3.2 tasks – งาน

| ID | Feature | รายละเอียด |
|---|---|---|
| TSK-1 | เพิ่มงาน | ชื่อ duration (วันทำงาน) เริ่มต้นวางต่อจากงานสุดท้ายหรือวันเริ่มโปรเจกต์ |
| TSK-2 | แก้ไขงาน | ชื่อ duration progress สี หมายเหตุ |
| TSK-3 | ลบงาน | ลบ dependency และ assignment ที่เกี่ยวข้องด้วย |
| TSK-4 | จัดลำดับแถว | ลากเรียงในตาราง เปลี่ยนค่า `order` |
| TSK-5 | Milestone | duration = 0 แสดงเป็นเพชร |
| TSK-6 | Constraint | ตั้งค่า "เริ่มไม่ก่อนวันที่" เมื่อลากงานใน Gantt |
| TSK-7 | ค้นหา / กรอง | กรองตามชื่อ ผู้รับผิดชอบ เฉพาะ critical เฉพาะยังไม่เสร็จ |
| TSK-8 | งานย่อย (checklist) | รายการติ๊กในแผงงาน เพิ่ม/แก้/ลบ/ลากเรียง ไม่ใช่งานใน Gantt เมื่อเปิดสวิตช์ % ของงาน = เสร็จ ÷ ทั้งหมด |
| TSK-9 | สร้างงานต่อจากงานนี้ | เลือกขั้นตอน (ออกแบบ UI, พัฒนา FE/BE, ทดสอบ, UAT, Deploy หรือเพิ่มเอง) ระบบสร้างงานและผูก FS ตามลำดับ ขั้นตอนคู่ขนานเริ่มพร้อมกัน รวมเป็นกลุ่มได้ จำรายการต่อโปรเจกต์ |
| AUTH-1 | เข้าสู่ระบบ | ผู้ใช้เดียว username/password ตั้งใน config (env หรือ backend/config.json) คุกกี้ session HttpOnly ทุก API ต้องล็อกอิน ยกเว้น health/login/me ออกจากระบบได้จาก header |

API

```
POST   /api/projects/{id}/tasks
PATCH  /api/projects/{id}/tasks/{taskId}
DELETE /api/projects/{id}/tasks/{taskId}
PATCH  /api/projects/{id}/tasks/reorder      # body: [taskId...]
```

### 3.3 dependencies – ความสัมพันธ์ระหว่างงาน

| ID | Feature | รายละเอียด |
|---|---|---|
| DEP-1 | เพิ่ม dependency | เลือกงานก่อนหน้า ประเภท FS / SS / FF / SF และ lag |
| DEP-2 | ลากสร้างใน Gantt | ลากจากปลายแถบงานหนึ่งไปอีกงาน ค่าเริ่มต้นเป็น FS lag 0 |
| DEP-3 | แก้ไข / ลบ | จากแผงงานหรือคลิกที่เส้นลูกศร |
| DEP-4 | ตรวจวงจร | ปฏิเสธ dependency ที่ทำให้เกิด cycle พร้อมแจ้งเส้นทางที่วน |
| DEP-5 | ป้องกันซ้ำ | คู่ (from, to) เดียวกันมีได้หนึ่งรายการ |

ความหมายของแต่ละประเภท (lag บวกเข้าไปเสมอ)

| ประเภท | เงื่อนไข |
|---|---|
| FS | to.start >= from.end + lag |
| SS | to.start >= from.start + lag |
| FF | to.end >= from.end + lag |
| SF | to.end >= from.start + lag |

API

```
POST   /api/projects/{id}/dependencies
PATCH  /api/projects/{id}/dependencies/{depId}
DELETE /api/projects/{id}/dependencies/{depId}
```

### 3.4 scheduling – เครื่องคำนวณตารางเวลาและ Critical Path

เป็น pure Python module ไม่ผูก FastAPI ทดสอบด้วย pytest ได้โดยตรง

| ID | Feature | รายละเอียด |
|---|---|---|
| SCH-1 | ปฏิทินวันทำงาน | นับเฉพาะวันทำงานของโปรเจกต์ ข้ามวันหยุด ฟังก์ชัน `add_working_days(date, n)` และ `working_days_between(a, b)` |
| SCH-2 | Forward pass | คำนวณ Early Start / Early Finish ตาม topological order |
| SCH-3 | Backward pass | คำนวณ Late Start / Late Finish จากวันจบโปรเจกต์ |
| SCH-4 | Float | Total Float = LS − ES และ Free Float |
| SCH-5 | Critical path | task ที่ Total Float = 0 พร้อมเส้นทางต่อเนื่องจากต้นถึงจบ |
| SCH-6 | Constraint | SNET ดัน ES ให้ไม่ก่อนวันที่กำหนด |
| SCH-7 | Milestone | duration 0 ใช้กติกาเดียวกัน |
| SCH-8 | สรุปโปรเจกต์ | วันจบโปรเจกต์ จำนวน critical ความคืบหน้าถ่วงน้ำหนักด้วย duration |
| SCH-9 | Summary rollup | คำนวณวันและ progress ของ summary task จากลูกหลัง forward pass และกระจาย dependency ที่ผูกกับ summary ไปยังลูก (ดู 3.12) |
| SCH-10 | Buffer | คำนวณ project buffer และ management reserve ตามวิธีที่ตั้งค่า (ดู 3.13) |

ผลลัพธ์ที่ส่งกลับใน `GET /api/projects/{id}` ต่อ task

```json
{
  "id": "t_01",
  "start": "2026-09-17", "end": "2026-09-23",
  "earlyStart": "...", "earlyFinish": "...", "lateStart": "...", "lateFinish": "...",
  "totalFloat": 0, "freeFloat": 0, "isCritical": true
}
```

API

```
GET /api/projects/{id}/schedule        # คืนเฉพาะผลคำนวณ ใช้ตอน preview ระหว่างลาก
POST /api/projects/{id}/schedule/preview   # ส่ง draft มาคำนวณโดยไม่บันทึก
```

### 3.5 gantt – มุมมอง Gantt (หน้าหลัก)

| ID | Feature | รายละเอียด |
|---|---|---|
| GNT-1 | ไทม์ไลน์เต็มจอ | คอลัมน์ชื่องานแคบซ้าย ไทม์ไลน์กินพื้นที่ที่เหลือ ตาม Layout 2 |
| GNT-2 | Zoom | วัน (36px/วัน) สัปดาห์ (คอลัมน์ละสัปดาห์) เดือน (คอลัมน์ละเดือน) |
| GNT-3 | แถบงาน | สีตาม critical / ทั่วไป แสดง progress เป็นเฉดทึบในแถบ ชื่อในแถบเมื่อกว้างพอ |
| GNT-4 | เส้น dependency | ลูกศรจากงานก่อนหน้า สีแดงบน critical path |
| GNT-5 | Float | เส้นประต่อท้ายแถบตามระยะ Total Float |
| GNT-6 | ลากเลื่อนงาน | ลากแถบเปลี่ยนวันเริ่ม สร้าง constraint SNET แสดง preview ผลกระทบก่อนปล่อย |
| GNT-7 | ลากปรับระยะเวลา | ลากขอบขวาเปลี่ยน duration |
| GNT-8 | ลากสร้าง dependency | จากจุดจับที่ปลายแถบไปยังอีกงาน |
| GNT-9 | Highlight critical path | สวิตช์เปิดปิด เมื่อปิดแสดงทุกงานสีเดียวกัน |
| GNT-10 | เส้นวันนี้ | เส้นแนวตั้งและปุ่ม "วันนี้" เลื่อนกลับ |
| GNT-11 | วันหยุดและสุดสัปดาห์ | แรเงาคอลัมน์ |
| GNT-12 | Drawer รายการงาน | ปุ่ม "รายการงาน" เปิดตารางเต็ม (ระยะ เริ่ม สิ้นสุด float ผู้ทำ) ซ้อนจากซ้าย |
| GNT-13 | แผงงาน | คลิกงานเปิดแผงขวาสำหรับแก้ไข (ดู 3.9) |
| GNT-14 | Milestone | เพชรสีเหลืองบนเส้นเวลา |

### 3.6 calendar – มุมมองปฏิทิน

| ID | Feature | รายละเอียด |
|---|---|---|
| CAL-1 | มุมมองเดือน | ตาราง 7 คอลัมน์ งานเป็นชิปในช่องวัน ทอดข้ามวันได้ |
| CAL-2 | มุมมองสัปดาห์ | แถวละทรัพยากร คอลัมน์ละวัน เห็นว่าแต่ละคนทำอะไร |
| CAL-3 | กรองตามทรัพยากร | เลือกหนึ่งคนหรือหลายคน สีชิปตามสีทรัพยากร |
| CAL-4 | ตราเตือนเกินกำลัง | ช่องวันที่ resource เกิน capacity แสดงตราสีแดงพร้อม % |
| CAL-5 | ลากย้ายวัน | ลากชิปไปวันอื่น ผลเหมือน GNT-6 |
| CAL-6 | คลิกเปิดแผงงาน | ใช้แผงเดียวกับ Gantt |
| CAL-7 | แสดงวันหยุด | ช่องสีจางพร้อมชื่อวันหยุดถ้ามี |

### 3.7 resources – ทรัพยากร

| ID | Feature | รายละเอียด |
|---|---|---|
| RES-1 | รายการทรัพยากร | ชื่อ ประเภท (คน / เครื่องมือ) capacity สี จำนวนงานที่ได้รับ ภาระงานสัปดาห์นี้ |
| RES-2 | เพิ่ม / แก้ / ลบ | ลบได้เมื่อไม่มี assignment ในโปรเจกต์ใด หรือยืนยันให้ถอดออกทั้งหมด |
| RES-3 | วันหยุดส่วนตัว | เพิ่มวันลา ระบบไม่นับเป็น capacity ในวันนั้น |
| RES-4 | ภาระงานรายวัน | แถบความร้อนรายวันต่อคน (ว่าง / เต็ม / เกิน) ในช่วงที่เลือก |
| RES-5 | รายการเตือนเกินกำลัง | สรุปว่าใคร วันไหน จากงานใดบ้าง กดแล้วไปที่งานนั้นใน Gantt |
| RES-6 | ใช้ข้ามโปรเจกต์ | ภาระงานรวมจากทุกโปรเจกต์ที่ assign resource นั้น |

API

```
GET    /api/resources
POST   /api/resources
PATCH  /api/resources/{id}
DELETE /api/resources/{id}
GET    /api/resources/workload?from=&to=&projectId=   # ภาระรายวัน คำนวณจากทุกโปรเจกต์
```

### 3.8 assignments – มอบหมายงาน

| ID | Feature | รายละเอียด |
|---|---|---|
| ASG-1 | มอบหมาย | เลือก resource และ units (%) ต่องาน หลาย resource ต่องานได้ |
| ASG-2 | แก้ไข / ถอน | จากแผงงาน |
| ASG-3 | คำนวณภาระ | ภาระของ resource ในวัน = ผลรวม units ของงานที่ทับวันนั้น |
| ASG-4 | ตรวจเกินกำลัง | ภาระ > capacityPerDay ถือว่าเกิน แจ้งทันทีในแผงงานเมื่อมอบหมาย |

API

```
POST   /api/projects/{id}/assignments
PATCH  /api/projects/{id}/assignments/{asgId}
DELETE /api/projects/{id}/assignments/{asgId}
```

### 3.9 task-panel – แผงรายละเอียดงาน (shared UI)

เป็น component ที่ใช้ร่วมกันระหว่าง Gantt และ Calendar

| ส่วน | เนื้อหา |
|---|---|
| หัว | หมายเลขงาน ชื่อ (แก้ไขในที่) ปุ่มปิด ตรา "อยู่บน Critical path" |
| ข้อมูลหลัก | duration, progress, เริ่ม / สิ้นสุด (อ่านอย่างเดียว คำนวณให้), สลับ milestone, constraint |
| งานก่อนหน้า | รายการ dependency แต่ละแถว: ชื่องาน, ประเภท, lag, ปุ่มลบ และปุ่มเพิ่ม |
| งานถัดไป | อ่านอย่างเดียว บอกว่างานนี้กระทบใคร |
| ผู้รับผิดชอบ | รายการ assignment: avatar ชื่อ units และคำเตือนเกินกำลัง |
| CPM | ES / EF / LS / LF / Total float / Free float |
| ปุ่ม | บันทึก ลบงาน |

### 3.10 io – นำเข้า / ส่งออก

| ID | Feature | รายละเอียด |
|---|---|---|
| IO-1 | Export JSON | ดาวน์โหลดไฟล์โปรเจกต์พร้อม resources ที่ใช้ |
| IO-2 | Import JSON | อัปโหลดสร้างโปรเจกต์ใหม่ map resource ตามชื่อ |
| IO-3 | Export CSV | ตารางงานพร้อมวันคำนวณและ float |
| IO-4 | Export PNG | ภาพ Gantt ตามช่วงที่แสดง |

### 3.11 history – Undo / Redo

| ID | Feature | รายละเอียด |
|---|---|---|
| HIS-1 | Undo / Redo | ฝั่ง frontend เก็บ snapshot ของโปรเจกต์ก่อนแก้ทุกครั้ง สูงสุด 50 ขั้น คีย์ลัด Ctrl+Z / Ctrl+Shift+Z |
| HIS-2 | Snapshot ไฟล์ | backend เก็บสำเนาไฟล์ก่อนเขียนไว้ที่ `data/backups/<id>/<timestamp>.json` เก็บ 20 ชุดล่าสุด |

### 3.12 wbs – กลุ่มงาน / Summary task

งานมีโครงสร้างต้นไม้ผ่าน `parentId` ลึกได้ไม่จำกัดแต่ UI แนะนำไม่เกิน 3 ชั้น

| ID | Feature | รายละเอียด |
|---|---|---|
| WBS-1 | สร้างกลุ่ม | ปุ่ม "เพิ่มกลุ่ม" หรือเลือกงานหลายตัวแล้ว "จัดกลุ่ม" ระบบสร้างงานแม่และย้ายงานที่เลือกเข้าไป |
| WBS-2 | ย่อหน้าเข้า / ออก | ปุ่ม indent / outdent ในตารางและคีย์ Tab / Shift+Tab เปลี่ยน `parentId` เป็นงานที่อยู่แถวบน |
| WBS-3 | ยุบ / ขยาย | ลูกศรหน้าชื่อ summary เก็บสถานะใน `collapsed` ยุบแล้ว Gantt ซ่อนแถวลูกแต่ยังแสดงแถบแม่ |
| WBS-4 | Rollup วันที่ | summary.start = min(start ของลูก), summary.end = max(end ของลูก), duration = วันทำงานระหว่างนั้น |
| WBS-5 | Rollup ความคืบหน้า | progress ของ summary = ผลรวม(progress × duration ของลูก) / ผลรวม duration ของลูก |
| WBS-6 | Dependency กับ summary | อนุญาตให้ summary เป็น predecessor / successor ได้ โดย engine กระจายไปยังลูกทุกตัว (FS จาก summary = FS จากลูกที่จบท้ายสุด) |
| WBS-7 | Critical path ของ summary | summary เป็น critical เมื่อมีลูกอย่างน้อยหนึ่งตัวเป็น critical แสดงเป็นแถบวงเล็บสีชมพู |
| WBS-8 | ลบกลุ่ม | ถามว่าจะลบลูกด้วยหรือย้ายลูกออกมาชั้นบน |
| WBS-9 | หมายเลข WBS | ตารางแสดงเลขลำดับชั้น เช่น 1, 1.1, 1.2, 2 คำนวณจาก order และ parentId |
| WBS-10 | ป้องกันวงจร | ห้ามย้ายงานไปเป็นลูกของลูกตัวเอง |

การแสดงผลใน Gantt: แถบ summary เป็นวงเล็บทึบสูง 10px สี `--ink` (หรือ `--critical` เมื่อ critical) มีขีดลงที่ปลายทั้งสอง ไม่มีที่จับลาก ชื่อในคอลัมน์ซ้ายเป็นตัวหนา 500 ย่อหน้าตามระดับ 16px ต่อชั้น

API

```
POST   /api/projects/{id}/tasks/group          # body: { name, taskIds[] }
PATCH  /api/projects/{id}/tasks/{taskId}/move  # body: { parentId, order }
```

### 3.13 buffers – สำรองเวลา (Schedule buffer)

#### หลักการที่ใช้

ระบบอ้างอิงหลัก 3 แนวจาก project management และให้ผู้ใช้เลือกวิธี

| วิธี | ที่มา | สูตร | เหมาะเมื่อ |
|---|---|---|---|
| `ccpm` (ค่าเริ่มต้น) | Critical Chain (Goldratt): ตัดเผื่อออกจากทุกงาน ให้ประเมินแบบ 50% แล้วรวมเผื่อไว้ท้ายโครงการเป็นก้อนเดียว | Project buffer = 50% ของระยะ critical chain (50% rule, ปรับสัดส่วนได้ 30 – 50%) และ Feeding buffer = 50% ของสายงานที่มาบรรจบ critical chain | duration ที่กรอกเป็นค่า "ถ้าราบรื่นจะเสร็จใน" ไม่มีเผื่อในตัว ระบบจะย้ำเรื่องนี้ตอนสร้างงานและตอนเลือกวิธี ถ้าใช้กับค่าประเมินปกติจะเผื่อซ้ำซ้อน ระบบจะเตือน (BUF-7) |
| `percent` | PMBOK: Contingency reserve สำหรับ "known unknowns" อยู่ใน schedule baseline และ Management reserve สำหรับ "unknown unknowns" อยู่นอก baseline | Project buffer = ระยะ critical path × % ตามระดับความเสี่ยง: ต่ำ 10%, กลาง 15%, สูง 25% และ management reserve แยกอีก 5 – 10% | ประเมิน duration แบบ "ปกติ" (มีเผื่อในตัวอยู่บ้าง) และไม่มีข้อมูล 3 จุด ซึ่งเป็นกรณีทั่วไปที่สุด |
| `pert` | PERT three-point estimate | ต่องาน: E = (O + 4M + P) / 6, σ = (P − O) / 6; รวมตาม critical path: σ_project = √Σσ²; buffer = 1σ สำหรับความเชื่อมั่น ~84% หรือ 2σ สำหรับ ~97.7% | ผู้ใช้กรอก optimistic / most likely / pessimistic ให้แต่ละงาน (เพิ่มฟิลด์ `estimate: { o, m, p }`) |

ค่าเริ่มต้นของระบบคือ **Critical Chain 50% rule**: project buffer = ครึ่งหนึ่งของระยะ critical chain และ management reserve 5% แยกต่างหาก ตัวอย่างในเอกสารนี้ critical chain 17 วันทำงาน → project buffer 9 วัน (ปัดขึ้น) และ management reserve 1 วัน วันเสร็จตามแผน 6 ต.ค. วันสัญญาส่ง 6 ต.ค. + 9 วันทำงาน = 19 ต.ค. เงื่อนไขสำคัญคือ duration ของทุกงานต้องกรอกแบบไม่เผื่อ ระบบจึงแสดงคำอธิบายนี้ทุกจุดที่กรอกเวลา

กติกาการปัด: ปัดขึ้นเป็นจำนวนวันทำงานเต็มเสมอ ขั้นต่ำ 1 วันเมื่อ critical path ยาวกว่า 5 วัน

#### ข้อความอธิบายใน UI (ใช้คำนี้ตรงตัวในหน้าตั้งค่า)

หน้าตั้งค่าแสดงเป็นการ์ดเลือก 3 ใบ แต่ละใบมี ชื่อ, หนึ่งประโยคว่าทำอะไร, "เหมาะเมื่อ", และตัวอย่างตัวเลขจากโปรเจกต์จริงของผู้ใช้ที่คำนวณสดให้เห็นผลทันทีเมื่อเปลี่ยน

| วิธี | ชื่อที่แสดง | ทำอะไร (1 ประโยค) | เหมาะเมื่อ | ตัวอย่างสด |
|---|---|---|---|---|
| ccpm | **รวมเผื่อไว้ท้ายโครงการ** (แนะนำ) | กรอกเวลาแต่ละงานแบบ "ถ้าราบรื่นจะเสร็จใน" โดยไม่ต้องเผื่อ แล้วระบบรวมเวลาเผื่อของทั้งโครงการไว้เป็นก้อนเดียวท้ายสุด เท่ากับครึ่งหนึ่งของสายงานหลัก | คุณตั้งใจกรอกเวลาแบบไม่เผื่อ และอยากเห็นชัดว่าเผื่อไว้กี่วัน ใช้ไปแล้วเท่าไร | "สายงานหลัก 17 วัน → เผื่อ 9 วัน → สัญญาส่ง 19 ต.ค." |
| percent | **บวกเพิ่มตามความเสี่ยง** | กรอกเวลาแบบปกติ (เผื่อในตัวเล็กน้อยได้) แล้วบวกเพิ่มท้ายโครงการตามระดับความเสี่ยง ต่ำ 10% กลาง 15% สูง 25% | คุณกรอกเวลาแบบที่คุ้นเคย หรือรับแผนมาจากคนอื่นที่เผื่อไว้แล้ว | "สายงานหลัก 17 วัน × 15% → เผื่อ 3 วัน → สัญญาส่ง 9 ต.ค." |
| pert | **ประเมิน 3 ค่า** | กรอก 3 ค่าต่องาน เร็วสุด / ปกติ / ช้าสุด ระบบคำนวณเวลาที่น่าจะเป็น และเผื่อตามความมั่นใจที่เลือก (84% หรือ 98%) | งานมีความไม่แน่นอนต่างกันมาก และคุณยอมกรอกข้อมูลเพิ่ม | "ความมั่นใจ 84% → เผื่อ 4 วัน → สัญญาส่ง 12 ต.ค." |

ใต้การ์ดมีบรรทัดเดียวเสมอ: "เวลาเผื่อสำหรับเรื่องที่คาดไม่ถึง (management reserve) อีก 5% จะไม่แสดงในแผนที่แชร์" พร้อมช่องปรับ %

จุดอื่นที่ต้องอธิบายซ้ำแบบสั้นเมื่อใช้ ccpm

- ช่องกรอกระยะเวลาในแผงงาน: placeholder "ถ้าราบรื่น กี่วัน" และ tooltip "ไม่ต้องเผื่อ ระบบเผื่อรวมไว้ท้ายโครงการแล้ว"
- แถบ buffer ใน Gantt: tooltip "เวลาเผื่อของทั้งโครงการ 9 วัน ใช้ไป 2 วัน (22%) ขณะที่งานหลักคืบหน้า 35% · ยังปลอดภัย"
- สัญญาณสี BUF-5: เขียว "ใช้เผื่อช้ากว่างานคืบหน้า", เหลือง "ใช้เผื่อพอๆ กับงานคืบหน้า จับตา", แดง "ใช้เผื่อเร็วกว่างานคืบหน้า ต้องแก้"

#### Feature

| ID | Feature | รายละเอียด |
|---|---|---|
| BUF-1 | ตั้งค่าสำรองเวลา | ในตั้งค่าโปรเจกต์: เลือกวิธี ระดับความเสี่ยง หรือกรอกวันเอง (override) แสดงคำอธิบายสั้นของหลักที่ใช้ |
| BUF-2 | คำนวณ project buffer | engine คืน `bufferDays`, `bufferEnd` (วันจบหลังบวก buffer) และ `managementReserveDays` ใน summary ของโปรเจกต์ |
| BUF-3 | แสดงใน Gantt | แถบ buffer ต่อท้าย milestone สุดท้ายของ critical path ลายทแยงสี `--critical-bg` ขอบ `--critical` มีป้าย "สำรอง 3 วัน" ส่วน management reserve เป็นเส้นประจางต่อจากนั้น ปิดได้ |
| BUF-4 | สองวันจบ | toolbar และรายการโปรเจกต์แสดง "เสร็จตามแผน 6 ต.ค. · สัญญาส่ง 9 ต.ค." |
| BUF-5 | ติดตามการใช้ buffer | เมื่อ critical path ล่าช้า (วันจบคำนวณเลื่อนออกจาก baseline ของวันจบ) ระบบคำนวณ % buffer ที่ถูกใช้ไป เทียบกับ % ความคืบหน้าของ critical path แสดงเป็นสัญญาณ เขียว (ใช้ < คืบหน้า) เหลือง (ใกล้เคียง) แดง (ใช้ > คืบหน้า + 20% หรือหมด) ตามแนวคิด fever chart ของ CCPM |
| BUF-6 | Feeding buffer (เฉพาะ ccpm) | คำนวณที่จุดที่สายงานไม่ critical มาบรรจบ critical chain แสดงเป็นแถบเล็กสีเทาก่อนงานที่บรรจบ ทำใน phase หลัง |
| BUF-7 | เตือนเผื่อซ้ำซ้อน | ถ้าเลือก ccpm และ progress จริงเร็วกว่าแผนต่อเนื่อง > 30% ของงานที่เสร็จ แสดงคำแนะนำว่าค่าประเมินอาจมีเผื่อในตัว ควรใช้ percent แทน |

API

```
PATCH  /api/projects/{id}/buffer        # body: { method, riskLevel, percent, days, managementReservePercent }
GET    /api/projects/{id}/schedule      # เพิ่มฟิลด์ buffer: { days, end, managementReserveDays, consumedPercent, status }
```

### 3.14 settings – กติกาการคำนวณที่ปรับได้

ทุกข้อมี default ที่เลือกจากหลัก PM ที่ใช้กันทั่วไป ผู้ใช้ปรับได้ต่อโปรเจกต์ในหน้าตั้งค่า แต่ละข้อแสดงเป็นการ์ดพร้อมคำอธิบายหนึ่งประโยคและตัวอย่างสดแบบเดียวกับ 3.13 หลักที่ใช้ระบุไว้ใต้ตัวเลือก

| ID | กติกา | ตัวเลือก (ตัวหนา = default) | หลักที่อ้างอิง | คำอธิบายใน UI |
|---|---|---|---|---|
| SET-1 | เกณฑ์ critical | **Float = 0** / Float ≤ N วัน (near-critical) | CPM มาตรฐานใช้ float 0; PMI แนะนำติดตาม near-critical เมื่อโครงการยาวหรือมีความไม่แน่นอนสูง | "งานที่เลื่อนแล้วโครงการเลื่อนทันที" vs "รวมงานที่เลื่อนได้ไม่เกิน N วันด้วย เพื่อจับตาล่วงหน้า" |
| SET-2 | วิธีรวม progress ของกลุ่มและโปรเจกต์ | **ถ่วงน้ำหนักด้วยระยะเวลา** / นับจำนวนงานที่เสร็จ / ถ่วงน้ำหนักด้วย effort (units × วัน) | Earned Value: % complete ควรถ่วงตามน้ำหนักงาน ไม่ใช่นับหัว | "งานยาวมีน้ำหนักมากกว่า" / "ทุกงานเท่ากัน ง่ายแต่หลอกได้" / "คิดตามแรงคน" |
| SET-3 | วิธีตรวจงานล่าช้า | **เทียบเวลาที่ผ่านไป (linear)** / เทียบ baseline (Earned Schedule) / เฉพาะเลยวันสิ้นสุด | Earned Schedule (Lipke) วัด SPI(t) จาก baseline; แบบ linear ใช้ได้เมื่อยังไม่มี baseline | "ผ่านไปครึ่งเวลา ควรได้ครึ่งงาน" / "เทียบกับแผนที่บันทึกไว้" / "เตือนเมื่อเลยกำหนดเท่านั้น" |
| SET-4 | เกณฑ์เกินกำลัง | **100%** / ปรับได้ 80 – 150% | Resource management: หลายทีมตั้งเพดานใช้งานจริงที่ 80% เผื่องานแทรก | "ถือว่าเกินเมื่อรวมงานเกินกี่ % ของวัน" |
| SET-5 | หน่วยของ lag | **วันทำงาน** / วันปฏิทิน | MS Project และ Primavera ใช้วันทำงานเป็นค่าเริ่มต้น วันปฏิทินใช้กับงานรอที่ไม่หยุดเสาร์อาทิตย์ เช่น รอปูนแห้ง รอเอกสาร | "ข้ามวันหยุด" / "นับทุกวันรวมวันหยุด เหมาะกับการรอ" |
| SET-6 | Dependency เริ่มต้นเมื่อลากเชื่อม | **FS lag 0** / เลือกประเภทและ lag | FS เป็นความสัมพันธ์ที่พบมากที่สุด (> 90% ในแผนทั่วไป) | "งานถัดไปเริ่มเมื่องานก่อนหน้าเสร็จ" |
| SET-7 | โหมดจัดตาราง | **อัตโนมัติ** / กำหนดเองเมื่อลาก | Auto-scheduling ตาม CPM; manual mode แบบ MS Project สำหรับคนที่อยากล็อกวัน | "ระบบขยับวันให้ตาม dependency เสมอ" / "ลากไปวางไว้ที่ไหน อยู่ที่นั่น ระบบแค่เตือน" |
| SET-8 | วันทำงานและวันหยุด | **จ – ศ** / จ – ส / ทุกวัน + วันหยุดรายโปรเจกต์ | ปฏิทินโครงการตาม PMBOK | มีอยู่แล้วใน PRJ-3 ย้ายมารวมในหน้านี้ |
| SET-9 | สัดส่วน buffer ของ ccpm | **50%** / 30 – 50% | Goldratt ใช้ 50%; งานที่ประเมินแม่นแล้วนิยมลดเหลือ 30 – 40% (Root Square Error method ให้ค่าประมาณนี้) | "ครึ่งหนึ่งของสายงานหลัก (มาตรฐาน)" / "ลดลงเมื่อทีมประเมินแม่น" |
| SET-10 | โซนสัญญาณการใช้ buffer | **เขียว < 1 เท่าของความคืบหน้า, เหลือง 1 – 1.2 เท่า, แดง > 1.2 เท่าหรือหมด** / ปรับได้ | Fever chart ของ CCPM แบ่ง 3 โซนตามสัดส่วน buffer ที่ใช้ต่อ chain ที่เสร็จ | "ใช้เผื่อช้ากว่างาน" / "พอๆ กัน จับตา" / "ใช้เผื่อเร็วกว่างาน ต้องแก้" |

ทุกกติกาเก็บใน `project.rules` (SET-9 และ SET-10 อยู่ใน `project.buffer`) engine อ่านค่าเหล่านี้ทุกครั้งที่คำนวณ การเปลี่ยนค่ามีผลทันทีและย้อนกลับได้ด้วย undo

API

```
PATCH  /api/projects/{id}/rules
GET    /api/settings/defaults          # default ทั้งหมดพร้อมคำอธิบาย ใช้ render หน้าตั้งค่า
```

## 4. ลำดับการพัฒนา

| Phase | Module | ผลลัพธ์ที่ใช้งานได้ |
|---|---|---|
| 1 | core storage, projects, tasks, dependencies, scheduling, wbs (WBS-4 ถึง WBS-7, WBS-10) | API ครบ คำนวณ CPM และ rollup ถูกต้อง มี unit test |
| 2 | frontend shell, projects, gantt (GNT-1 ถึง GNT-5, GNT-9 ถึง GNT-14), task-panel, wbs UI (WBS-1 ถึง WBS-3, WBS-8, WBS-9), buffers (BUF-1 ถึง BUF-4), settings (SET-1, SET-5 ถึง SET-9) | ดูและแก้แผนผ่าน Gantt ได้ เห็นกลุ่มงานและวันสัญญาส่ง ปรับกติกาหลักได้ |
| 2.5 | settings (SET-2, SET-3, SET-4, SET-10) | เมื่อมี progress, baseline และ resource แล้วจึงเปิดกติกาที่เกี่ยวข้อง |
| 3 | gantt ลาก (GNT-6 ถึง GNT-8) | วางแผนด้วยเมาส์ได้ |
| 4 | resources, assignments | มอบหมายและเห็นเกินกำลัง |
| 5 | calendar, buffers (BUF-5) | มุมมองรายวันตามทรัพยากร ติดตามการใช้ buffer |
| 6 | io, history, buffers (BUF-6, BUF-7) | ส่งออก ย้อนกลับ และ feeding buffer |

## 5. Non-functional

- โปรเจกต์ขนาดถึง 500 งาน คำนวณ schedule ต่ำกว่า 100 ms
- เขียนไฟล์แบบ atomic (เขียน temp แล้ว rename) และ lock ต่อไฟล์ระหว่างเขียน
- ทุกการแก้ไขตอบกลับด้วย schedule ใหม่ทั้งชุด frontend ไม่คำนวณ CPM เอง (ยกเว้น preview ระหว่างลาก ซึ่งเรียก preview endpoint แบบ debounce)
- รองรับหน้าจอกว้างตั้งแต่ 1024px ขึ้นไป ต่ำกว่านั้นซ่อนคอลัมน์ชื่องานและใช้ drawer

## 6. รายละเอียด API ที่สรุปตอนพัฒนา (Phase 1)

สิ่งที่ตัดสินใจเพิ่มระหว่างเขียนโค้ด ถ้าขัดกับหัวข้อก่อนหน้า ให้ยึดหัวข้อนี้

- **ทุก mutation ตอบกลับ `ProjectOut`** คือโปรเจกต์ทั้งก้อน (tasks, dependencies, assignments, rules, buffer) บวก `schedule` ที่คำนวณใหม่ ยกเว้น `DELETE /projects/{id}` ตอบ 204
- **รูปแบบ error** ทุกกรณีเป็น `{ "error": { "code", "message", "details" } }` code ที่ใช้: `not_found` (404), `validation_failed` (422), `cycle_detected` (422, `details.path` คือรายชื่องานที่วนกลับมาตัวแรก), `conflict` (409)
- **การแก้ไขที่ทำให้กราฟไม่ถูกต้อง** (cycle, dependency ในสาย WBS เดียวกัน, parent ที่ไม่มี) จะถูกปฏิเสธและไม่บันทึกอะไรเลย
- **ตำแหน่ง milestone** = วันสิ้นสุดของงานก่อนหน้า (เช่น งานจบ 6 ต.ค. milestone แสดง 6 ต.ค.) ถ้าไม่มีงานก่อนหน้า = วันเริ่มโปรเจกต์
- **Task fields เพิ่มเติม** `collapsed` (สถานะยุบใน UI), `estimate: { o, m, p }` สำหรับ PERT
- **Tasks endpoints**
  - `POST /tasks` body เพิ่ม `afterId` แทรกหลัง sibling ที่ระบุ ค่าเริ่มต้นต่อท้าย
  - `PATCH /tasks/{id}` มี `clearConstraint`, `clearEstimate` สำหรับล้างค่า; ตั้ง `isMilestone: true` จะบังคับ duration = 0
  - `DELETE /tasks/{id}?mode=lift|cascade` (ค่าเริ่มต้น lift = ยกลูกขึ้นชั้นบน) ลบ dependency และ assignment ที่เกี่ยวข้องให้
  - `PATCH /tasks/reorder` body `{ parentId, ids }` ต้องส่ง sibling ครบทุกตัว
  - `POST /tasks/group` body `{ name, taskIds }` งานที่เลือกต้องมี parent เดียวกัน กลุ่มใหม่วางที่ตำแหน่งของงานแรกที่เลือก
  - `PATCH /tasks/{id}/move` body `{ parentId, order }` order เป็นตำแหน่ง 1-based ในกลุ่มใหม่
- **Dependencies** `POST` ไม่ส่ง `type`/`lag` จะใช้ `rules.defaultDependency`
- **Preview** `POST /schedule/preview` body เป็นบางส่วนของโปรเจกต์ (`tasks`, `dependencies`, `rules`, `buffer`, `holidays`, `workingDays`, `startDate`) แทนที่ทั้งรายการ หรือ `patchTasks` แทนที่เฉพาะงานที่ id ตรง เหมาะกับตอนลาก
- **Settings** `GET /settings/defaults` คืน `rules`, `buffer` ค่าเริ่มต้น และ `bufferMethods`, `ruleDescriptions`, `managementReserve` ที่มีข้อความภาษาไทยสำหรับหน้าตั้งค่า (ข้อ 3.13 และ 3.14) UI ต้องใช้ข้อความจากที่นี่ ไม่ hardcode ซ้ำ
- **Schedule ต่อ task** มี `wbs`, `depth`, `isSummary`, `isMilestone`, `es/ef/ls/lf` (index วันทำงาน), `start/end` และ late dates, `totalFloat`, `freeFloat`, `isCritical`, `isNearCritical`, `progress` (rollup แล้ว)
- **Schedule summary** มี `plannedEnd`, `committedEnd` (= plannedEnd + buffer), `chainDays`, `criticalCount`, `nearCriticalCount`, `taskCount` (นับเฉพาะ leaf), `progress`
- **Buffer** `days` ถูกปัดขึ้น ขั้นต่ำ 1 วันเมื่อ chain > 5 วัน; pert ที่ยังไม่มีค่า 3 จุดบางงานจะคืน `note` บอกจำนวนงานที่ขาด; `consumedPercent` และ `status` ยังเป็น null จนกว่าจะมี baseline (Phase 5)
- **การเก็บไฟล์** เขียนแบบ atomic พร้อม backup 20 ชุดล่าสุดที่ `data/backups/<id>/` ลบโปรเจกต์ย้ายไป `data/trash/` ส่วน `index.json` สร้างใหม่อัตโนมัติถ้าหาย

## 7. รายละเอียด UI ที่สรุปตอนพัฒนา (Phase 2)

- **Shell** ใช้ Layout 2: header bar สีม่วงมี brand, project switcher (popover รายชื่อโปรเจกต์ 8 รายการล่าสุด + ลิงก์ดูทั้งหมด) และแท็บ Gantt / ปฏิทิน / ทรัพยากร / ตั้งค่า บนมือถือแท็บยุบเป็นเมนู ⋯ (BottomNav มาใน Phase 6)
- **การเลือกงาน** อยู่ใน URL `?task=<id>` เสมอ เพื่อให้ refresh / แชร์ลิงก์แล้วเปิดแผงเดิม
- **Gantt** คอลัมน์ชื่อ 220px (มือถือ 120px ซ่อนเลข WBS) แกนเวลาเป็นวันปฏิทิน ความกว้างต่อวัน 36 / 12 / 4 px ตาม zoom วัน / สัปดาห์ / เดือน ค่า zoom จำไว้ใน localStorage มือถือเริ่มที่สัปดาห์ แถวสูง 44px ทุกอุปกรณ์
- **Milestone** วาดเพชรที่ขอบท้ายของวันที่ engine คืน ลูกศร FS เข้าที่มุมซ้ายของเพชร
- **แถวสำรองเวลา** แสดงเมื่อ buffer > 0: แถบลายทแยงจาก plannedEnd ถึง buffer.end เพชรดำที่ปลาย เส้นประ management reserve ต่อท้าย พร้อมป้าย "สัญญาส่ง"
- **เพิ่มงาน** ผ่าน dialog (ชื่อ ระยะเวลา กลุ่ม milestone) แล้วเลือกงานใหม่อัตโนมัติ placeholder ระยะเวลาเปลี่ยนตามวิธี buffer ("ถ้าราบรื่น กี่วัน" เมื่อ ccpm)
- **แผงงาน** autosave ชื่อ / ระยะเวลา / ความคืบหน้า หลังหยุดพิมพ์ 500 ms หรือเมื่อ blur; toggle และ dependency บันทึกทันที; ปุ่ม "เสร็จสิ้น" flush แล้วปิด; Esc ปิด; งานที่เป็นกลุ่มแสดงระยะเวลาและความคืบหน้าแบบอ่านอย่างเดียว; ลบกลุ่มถามว่าจะยกลูกขึ้นหรือลบทั้งกลุ่ม; error `cycle_detected` แปลเป็น "สร้างวงจรไม่ได้ งานนี้จะวนกลับมาหาตัวเอง"
- **รายการงาน (drawer)** กว้าง 720px แสดงตารางเต็ม จัดลำดับด้วยปุ่ม เลื่อนขึ้น / เลื่อนลง / ย่อหน้าเข้า (เป็นลูกของงานบน) / ย่อหน้าออก (ไปอยู่หลังงานแม่) การลากเรียงยกไป Phase 3
- **ตั้งค่า** การ์ดสำรองเวลา 3 ใบ ใบที่ไม่ได้เลือกคำนวณตัวอย่างสดผ่าน `POST /schedule/preview`; สลับ percent → ccpm ขณะมีงานจะถาม 1 ครั้งและเสนอลด duration 20% (ceil) ทุก leaf ที่ > 1 วัน; การ์ดกติกา render จาก `ruleDescriptions` ของ API; ทุกการเปลี่ยนมี toast "เลิกทำ" คืนค่าเดิม
- **Toast** desktop มุมล่างขวา มือถือด้านบน (ไม่บังปุ่มของ bottom sheet)
- **การทดสอบ** e2e รันบน backend พอร์ต 8001 + Vite พอร์ต 5174 พร้อม `DATA_DIR=.e2e-data` แยกจาก dev server และล้างข้อมูลก่อนทุกครั้ง โปรเจกต์ตัวอย่างสำหรับภาพหน้าจอ seed ผ่าน API (`frontend/shots/seed.ts`)

## 8. รายละเอียดที่สรุปตอนพัฒนา (Phase 3 – การลากและ undo)

- **ย้ายงานด้วยการลาก** = ตั้ง constraint SNET เป็นวันที่วาง (ปัดไปวันทำงานถัดไป) ระบบยังคงคำนวณตาม dependency จึงอาจไม่ได้เริ่มวันนั้นพอดีถ้างานก่อนหน้าบังคับ (ตาม `schedulingMode: auto`; โหมด manual ยังทำงานเหมือน auto ในเวอร์ชันนี้)
- **ปรับระยะเวลา** ลากขอบขวา นับเป็นวันทำงานระหว่างวันเริ่มเดิมถึงวันที่วาง ขั้นต่ำ 1 วัน
- **Preview ระหว่างลาก** ส่ง `patchTasks` ไป `/schedule/preview` ทุกครั้งที่ค่าสแนปเปลี่ยน (ไม่ใช่ทุก pixel) แถบที่วันเปลี่ยนจะมีเส้นประล้อม ชิปวันจบและแถวสำรองเวลาแสดงค่าจาก preview พร้อมคำว่า "(ตัวอย่าง)"
- **สร้าง dependency ด้วยการลาก** จากจุดกลมท้ายแถบ (แสดงเมื่อเลือกงานหรือ hover) ไปวางบนแถวใดก็ได้ ประเภทและ lag ใช้ค่าจาก `rules.defaultDependency`
- **คลิกลูกศร** เปิด popover แก้ประเภท lag หรือลบ (พื้นที่คลิกกว้าง 12px ตามแนวเส้น ส่วนที่ทับแถบงานจะคลิกโดนแถบแทน)
- **Undo/redo** เก็บ snapshot ของโปรเจกต์ก่อนทุก mutation ที่ผูกกับโปรเจกต์ (สูงสุด 50) การเลิกทำส่ง snapshot ทั้งก้อนผ่าน `PUT /api/projects/{id}` (รับเฉพาะฟิลด์ที่แก้ได้ ตรวจ cycle เหมือนปกติ) ประวัติอยู่ในหน่วยความจำ หายเมื่อ refresh
- **คีย์ลัด** N เพิ่มงาน · 1/2/3 zoom · T วันนี้ · C สลับ critical · Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y ไม่ทำงานขณะพิมพ์ในช่องกรอกหรือเมื่อมี dialog เปิด (ยกเว้น undo/redo ที่ทำงานเสมอเว้นแต่กำลังพิมพ์)
- **อุปกรณ์สัมผัส** ไม่เริ่มการลาก (pointerType touch) ตามสเปกมือถือ ใช้แผงงานปรับค่าแทน

## 9. รายละเอียดที่สรุปตอนพัฒนา (Phase 4 – ทรัพยากร)

- **ไฟล์ resources.json** มี backup 20 ชุดที่ `data/backups/resources/` สีทรัพยากรวนจาก palette 7 สีเมื่อไม่ระบุ
- **`GET /api/resources`** คืน `assignmentCount` และ `projectCount` รวมทุกโปรเจกต์ · **`DELETE /api/resources/{id}`** ตอบ 409 พร้อมรายชื่อโปรเจกต์ที่ใช้อยู่ ต้องส่ง `?force=true` เพื่อถอดออกจากทุกงานแล้วลบ
- **Assignments** `POST /projects/{id}/assignments` (taskId, resourceId, units) ห้ามซ้ำคู่ task+resource · `PATCH .../{asgId}` แก้ units · `DELETE .../{asgId}` ทุกตัวตอบ `ProjectOut` และเข้าประวัติ undo
- **Workload** `GET /api/resources/workload?from&to&projectId&resourceId=…` คำนวณสดจาก schedule ของทุกโปรเจกต์ (เฉพาะ leaf task ไม่รวม milestone) ต่อวันทำงานของโปรเจกต์นั้น `over` เมื่อ load > capacity × threshold/100 หรือเป็นวันลาของทรัพยากร (capacity 0) `threshold` มาจาก `rules.overallocationThreshold` ของ projectId ที่ส่ง ไม่ส่งใช้ 100 ช่วงสูงสุด 400 วัน
- **UI** ชิป "เกินกำลัง N คน" บน Gantt และคำเตือนในแผงงานกรองเฉพาะทรัพยากรที่เกี่ยวข้อง (ส่ง resourceId) เพื่อไม่ให้โปรเจกต์อื่นมารบกวน · หน้าทรัพยากรรวมวันเกินกำลังที่ติดกัน (ข้ามสุดสัปดาห์ได้) ของงานชุดเดียวกันเป็นแถวเดียว · ช่วงความร้อนเริ่มที่สัปดาห์ปัจจุบัน 14 วัน เปลี่ยนวันเริ่มได้ · เปิดจาก `/resources?project=<id>` เพื่อใช้เกณฑ์ของโปรเจกต์นั้น
- **มือถือ** ตารางทรัพยากรกลายเป็นการ์ดต่อคน (ตาม ui-design 5.5) ยังไม่มี bottom sheet แก้ไข ใช้ dialog เดิมซึ่งเป็น sheet อยู่แล้ว

## 10. รายละเอียดที่สรุปตอนพัฒนา (Phase 5 – ปฏิทิน, baseline, การใช้ buffer)

- **Baseline** `POST /api/projects/{id}/baseline` เก็บ `savedAt`, `plannedEnd`, `chainDays`, `bufferDays` และ start/end ของทุก leaf task ลงในไฟล์โปรเจกต์ (`project.baseline`) · `DELETE` ล้าง · ไม่อยู่ในสิ่งที่ undo/redo แตะ
- **Buffer ถูกล็อกที่ baseline**: เมื่อมี baseline ขนาดเผื่อ (`bufferDays`) และจุดเริ่ม (`buffer.start` = plannedEnd ตอน baseline) จะคงที่ วันสัญญาส่งจึงไม่ขยับตามแผนที่เลื่อน การเปลี่ยนวิธี buffer มีผลเมื่อบันทึก baseline ใหม่เท่านั้น · UI: ชิป "เผื่อ N วัน" บน Gantt มีไอคอนล็อกและ tooltip อธิบาย (สายงานหลักตอน baseline เทียบตอนนี้) และหน้าตั้งค่าเตือนเมื่อสายงานหลักเปลี่ยนเกิน 25% จาก baseline พร้อมปุ่ม "บันทึกใหม่จากแผนปัจจุบัน"
- **การใช้ buffer** `consumedDays` = วันทำงานที่ plannedEnd ปัจจุบันเลยจาก baseline · `consumedPercent` = consumed / bufferDays · `chainProgress` = ความคืบหน้าถ่วงน้ำหนักของงานบน critical path · สัญญาณ: แดงเมื่อ consumed ≥ 100% หรือ consumed/chainProgress > `bufferZones.red` (ค่าเริ่มต้น 120%) เหลืองเมื่อ > `bufferZones.yellow` (100%) หรือใช้เผื่อแล้วแต่งานหลักยังไม่คืบ ที่เหลือเขียว
- **สถานะงาน (`health`)** ต่อ leaf: `done` เมื่อ 100% · `not_started` ก่อนวันเริ่ม · `late` / `on_track` ตาม `lateDetection`: linear = ความคืบหน้าที่ควรได้ตามวันทำงานที่ผ่านไปในงาน (ยอมคลาด 10 จุด) · baseline = คำนวณจากช่วงวันของ baseline · overdue = ล่าช้าเมื่อเลยวันสิ้นสุดเท่านั้น กลุ่มงานล่าช้าเมื่อลูกใดล่าช้า `expectedProgress` ส่งกลับด้วย engine รับ `today` เป็นพารามิเตอร์เพื่อทดสอบได้
- **ปฏิทิน** แสดงเฉพาะ leaf task สีชิปตามคนแรกที่รับผิดชอบ (critical เป็นชมพูเสมอ) ชิปที่ล่าช้ามีขอบชมพู · เดือน: 6 สัปดาห์ สูงสุด 3 แถวชิปต่อสัปดาห์ เกินแสดง "+N งาน" · สัปดาห์ตามทรัพยากร: ซ่อนชิปในวันหยุด/วันไม่ทำงาน แถว "ยังไม่มอบหมาย" เมื่อไม่กรอง · ตราจำนวนคนเกินกำลังใช้ workload ของช่วงที่แสดง · ลากชิปไปวางวันอื่น = constraint SNET เหมือน Gantt (เฉพาะเมาส์)
- **มือถือ** ปฏิทินเป็นรายการวัน จ–อา ของสัปดาห์ (ui-design 5.4) ปัดซ้าย/ขวาเปลี่ยนสัปดาห์ได้ (Phase 6) หรือใช้ปุ่ม ‹ ›

## 11. รายละเอียดที่สรุปตอนพัฒนา (Phase 6 – มือถือ)

- **BottomNav** (< 768px) สูง 64px + safe-area: Gantt · ปฏิทิน · ปุ่ม + นูนตรงกลาง · ทรัพยากร · โปรเจกต์ เมื่อไม่ได้อยู่ในโปรเจกต์เหลือ โปรเจกต์ · ทรัพยากร เมนู ⋯ บน header ยังอยู่เพื่อเข้าหน้าตั้งค่า
- **ปุ่ม +** ส่งสัญญาณผ่าน `uiStore.requestAddTask` ถ้าไม่ได้อยู่หน้า Gantt จะนำทางไปก่อนแล้วเปิดกล่องเพิ่มงาน ปุ่ม "เพิ่มงาน" เดิมบน Gantt ซ่อนบนมือถือ
- **Gantt มือถือ** ตัวเลือกซูม "วัน" ถูกซ่อน และค่าที่จำไว้ว่า day จะถูกมองเป็น week (ui-design 5.2) ปุ่ม "วันนี้" ในแถบเครื่องมือซ่อน ใช้ปุ่มลอยมุมขวาล่างเหนือ BottomNav แทน การลาก/ปรับขนาดยังปิดสำหรับ touch (แก้ผ่านแผงงาน)
- **ปฏิทินมือถือ** ปัดในการ์ดรายการวัน ระยะเกิน 60px = เปลี่ยนสัปดาห์ (ซ้าย = ถัดไป) ใช้ touch events จึงไม่รบกวนการลากด้วยเมาส์บนเดสก์ท็อป
- **การทดสอบมือถือ** e2e project `mobile` (Pixel 7) จำลองการปัดด้วย CDP `Input.dispatchTouchEvent` เพราะ `dispatchEvent('touchstart')` ต้องการ Touch object เต็มรูปแบบ

## 12. รายละเอียดที่สรุปตอนพัฒนา (Phase 7 – นำเข้า/ส่งออก, BUF-7, QA)

- **ไฟล์โปรเจกต์** `GET /api/projects/{id}/export` → `{format:"phaengan-project", version:1, exportedAt, project:{…ProjectState + baseline}, resources:[เฉพาะที่ถูกมอบหมาย]}` ส่งหัว Content-Disposition ให้เบราว์เซอร์ดาวน์โหลดเป็น `<ชื่อโปรเจกต์>.phaengan.json` ไม่มี id/timestamps/schedule ของโปรเจกต์ในไฟล์
- **นำเข้า** `POST /api/projects/import` รับเอกสารเดียวกัน (+ `name` เพื่อตั้งชื่อใหม่) ตรวจ `format` และความครบของกราฟ (งานซ้ำ, ความสัมพันธ์/กลุ่ม/การมอบหมายที่อ้างงานที่ไม่มี) ก่อน จากนั้นจับคู่ทรัพยากรด้วยชื่อแบบ normalize (ตัดช่องว่างซ้ำ + casefold) ที่ไม่พบสร้างใหม่โดยใช้ type/กำลัง/สี/วันลาจากไฟล์ แล้วสร้างโปรเจกต์ id ใหม่ (คง id งาน/ความสัมพันธ์เดิม) ผ่าน engine เหมือน mutation อื่น จึงจับ cycle ได้ ผลลัพธ์ `{project, result:{projectId, createdResources, matchedResources}}` ฝั่ง UI ตรวจ `format` ก่อนส่งและแสดง toast สรุปการจับคู่
- **CSV** `GET /api/projects/{id}/export.csv` เรียงตาม WBS คอลัมน์: WBS ชื่องาน ประเภท ระยะเวลา เริ่ม สิ้นสุด เริ่มช้าสุด เสร็จช้าสุด Total float Free float Critical ความคืบหน้า สถานะ ผู้ทำ งานก่อนหน้า ปิดท้ายด้วยแถวสำรองเวลาโครงการ ขึ้นต้นด้วย BOM เพื่อให้ Excel อ่านภาษาไทยได้
- **PNG** ทำในเบราว์เซอร์ด้วย html-to-image บนกล่อง `[data-testid=gantt-chart]` (pixelRatio 2, ข้าม web font ที่ข้ามโดเมน) ได้ภาพช่วงที่เลื่อนอยู่พร้อมคอลัมน์ชื่อ ไม่ต้องพึ่งเซิร์ฟเวอร์
- **BUF-7** engine ตั้ง `buffer.paddingWarning`/`paddingNote` เมื่อใช้ ccpm และงานที่ "เริ่มแล้วจริง" (progress > 0, ถึงวันเริ่มแล้ว, ไม่ใช่ milestone) มีอย่างน้อย 3 งาน และเกิน 30% ของงานเหล่านั้นคืบหน้าเกินค่าคาดแบบ linear มากกว่า 30 จุดหรือเสร็จก่อนวันสิ้นสุด แสดงเป็นชิปเตือนบน Gantt (hover อ่านคำอธิบาย) และกล่องคำอธิบายใต้การ์ด Critical Chain ในหน้าตั้งค่า
- **QA** สีข้อความรอง `--text-3` เปลี่ยนเป็น #716a91 เพื่อผ่าน WCAG AA (ตรวจอัตราส่วนคู่สีหลักทั้งหมดด้วยสคริปต์: text-2 5.15, primary 5.64, warn 4.25 บนพื้นเตือน, critical 4.91) คีย์บอร์ดมี e2e ครอบ N / Esc / Tab focus ring / Enter บนแถบ / Ctrl+Z · โปรเจกต์ 60 งานผ่าน `PUT /projects/{id}` ใช้เป็นชุดทดสอบใหญ่ใน e2e

## 13. รายละเอียดที่สรุปตอนพัฒนา (งานย่อย TSK-8 และงานต่อเนื่อง TSK-9)

- **โมเดล** `task.checklist: [{id, text, done}]`, `task.progressFromChecklist` (ค่าเริ่มต้น true), `project.chainTemplates` (แถวล่าสุดของกล่องสร้างงานต่อเนื่อง) ทั้งหมดอยู่ในไฟล์โปรเจกต์ ถูก undo/redo, export/import ตามปกติ
- **API งานย่อย** ใช้ `PATCH /tasks/{id}` ส่ง `checklist` ทั้งรายการ (ลำดับ = ลำดับในรายการ) รายการที่ไม่มี id จะได้ id `c_…` จากเซิร์ฟเวอร์ · `validate_and_save` ทำให้ `progress = round(done/total)` ทุกครั้งที่บันทึกเมื่อสวิตช์เปิดและมีรายการ จึงไม่มีทางที่ % กับงานย่อยไม่ตรงกัน แก้ % เองได้เมื่อปิดสวิตช์ ลบรายการจนหมดแล้ว % คงค่าสุดท้าย
- **API งานต่อเนื่อง** `POST /tasks/{id}/chain` body `{steps:[{name,duration,enabled,parallel}], prefixWithSource, groupName, copyAssignees, remember}` สร้างเฉพาะ `enabled` เรียงต่อจากงานต้นทางทันที (เลื่อน order ของงานถัดไป) ผูก FS จากบล็อกก่อนหน้า: ขั้นตอน `parallel` อยู่บล็อกเดียวกับขั้นตอนก่อนหน้าและใช้งานก่อนหน้าชุดเดียวกัน ขั้นตอนถัดไปรอทุกงานในบล็อก · `groupName` สร้างกลุ่มใหม่แทนที่ตำแหน่งงานต้นทาง ย้ายงานต้นทางเป็นลูกตัวแรก · `copyAssignees` คัดลอกการมอบหมายของงานต้นทาง (หน่วยเท่าเดิม) · `?dryRun=true` คืน ProjectOut ที่จะได้โดยไม่บันทึก ใช้ทำพรีวิว (วันเสร็จ, อยู่บน critical path ไหม) · ปฏิเสธเมื่อเรียกบนกลุ่มงานหรือไม่มีขั้นตอนที่เลือก
- **UI** ส่วน "งานย่อย" และ "งานต่อเนื่อง" อยู่ระหว่างสวิตช์ milestone กับงานก่อนหน้าในแผงงาน (ไม่แสดงบนกลุ่มงาน) ช่องความคืบหน้าอ่านอย่างเดียวพร้อม hint "จากงานย่อย" เมื่อสวิตช์เปิด · กล่องสร้างงานต่อเนื่องเริ่มจาก `chainTemplates` ของโปรเจกต์ ถ้าไม่มีใช้ค่าเริ่มต้น 6 แถว (ออกแบบ UI 3, พัฒนา Frontend 5, พัฒนา Backend 5 คู่ขนาน, ทดสอบ 3, UAT 2 ไม่ติ๊ก, Deploy 1) พรีวิวเรียกดรายรันหน่วง 300 ms

## 14. รายละเอียดที่สรุปตอนพัฒนา (AUTH-1 และการติดตั้งสาธารณะ)

- **Config** `app/core/config.py` รวมค่าจาก env > `backend/config.json` > ค่าเริ่มต้น เป็น `Settings` (แคชต่อ process) ดูตาราง key ทั้งหมดใน `docs/deploy.md`
- **Auth** `features/auth`: `POST /api/auth/login` ตรวจด้วย `secrets.compare_digest` แล้วตั้งคุกกี้ `phaengan_session` = `<exp>.<username>.<hmac>` (ไม่มี session store) · `GET /api/auth/me` · `POST /api/auth/logout` ลบคุกกี้ · throttle 5 ครั้ง/นาที/IP (in-memory) · `AuthGateMiddleware` ใน `app/core/web.py` ปฏิเสธ `/api/*` ที่ไม่มีคุกกี้ด้วย `{error:{code:"unauthorized"}}` ยกเว้น health/login/me และ OPTIONS · `AUTH_DISABLED` ใช้ในเทสต์ (conftest เปิดให้ทุกเทสต์ ยกเว้น fixture `auth_env`)
- **Frontend** `features/auth`: `RequireAuth` ครอบทุก route ใต้ AppShell รอ `/auth/me` แล้วส่งไป `/login` พร้อม `state.from`; `api()` ส่ง `credentials: same-origin` และเรียก listener `onUnauthorized` เมื่อได้ 401 จาก endpoint อื่น (session หมดอายุกลางทาง) · ปุ่มออกจากระบบอยู่ขวาสุดของ header (desktop) และในเมนู ⋯ (มือถือ) ซ่อนเมื่อ `authDisabled`
- **E2E** backend ของ Playwright รันด้วยล็อกอินเปิด (`e2e`/`e2e-password`) project `setup` ล็อกอินผ่าน API แล้วเก็บ storageState ที่ `frontend/.auth/state.json` ให้ desktop/mobile ใช้ · `login.spec.ts` และหน้าจอ `login*` เริ่มแบบไม่มี session (`noAuth` ใน screens.ts)
- **Hosting** `mount_spa` เสิร์ฟ `STATIC_DIR` เมื่อมี: `/assets/*` แบบ static, path อื่นที่ไม่ใช่ `/api` ตอบ `index.html` (deep link ได้) ป้องกัน path traversal · `SecurityHeadersMiddleware`, GZip, ปิด `/docs` · Dockerfile หลายขั้น + `docker-compose.yml` + `deploy/Caddyfile` (HTTPS อัตโนมัติ) ดู `docs/deploy.md`

