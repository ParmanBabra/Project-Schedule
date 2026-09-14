# Design System – แผนงาน

สไตล์ "สดใส เป็นมิตร" (แนวทาง D) ใช้กับทุกหน้าและทุกอุปกรณ์ ค่าทั้งหมดอยู่ในไฟล์ [tokens.css](../frontend/src/shared/styles/tokens.css) (สร้างแล้วที่ `docs/design/tokens.css` ให้ย้ายเข้า frontend ตอนตั้งโปรเจกต์)

## 1. หลักการ

1. **ข้อมูลอยู่บนการ์ดสีขาว พื้นหลังสีม่วงอ่อน** ทุกพื้นที่เนื้อหาเป็นการ์ดมุมโค้ง 18px ลอยบนพื้น `#f2f0fa`
2. **สีมีความหมายคงที่** ม่วง = ระบบและการนำทาง ชมพูเข้ม = critical path เขียวมินต์ = งานทั่วไป เหลือง = milestone อำพัน = คำเตือน ห้ามสลับความหมาย
3. **ทรงเม็ดยา (pill) สำหรับสิ่งที่กดได้** ปุ่ม ชิป แท็บ segment และแถบงาน ล้วนโค้งเต็ม ส่วนการ์ดและช่องกรอกโค้ง 12 – 18px
4. **ไม่มีเส้นขอบเข้ม** แยกส่วนด้วยพื้นหลัง ระยะห่าง และเงาบางเท่านั้น เส้นแบ่งใช้สี `#ece9f6` หรือจางกว่า
5. **หนึ่งฟอนต์** Kanit น้ำหนัก 400 / 500 / 600 ไม่ใช้ตัวหนา 700

## 2. Tokens

### 2.1 สี

| Token | ค่า | ใช้กับ |
|---|---|---|
| `--bg` | `#f2f0fa` | พื้นหลังหน้า |
| `--surface` | `#ffffff` | การ์ด แผง ตาราง |
| `--surface-2` | `#f7f5fc` | คอลัมน์สุดสัปดาห์ แถวสลับ |
| `--surface-3` | `#f2f0fa` | ช่องกรอก พื้นปุ่มรอง |
| `--border` | `#ece9f6` | เส้นแบ่งหลัก |
| `--border-soft` | `#f1eff8` | เส้นแบ่งแถว |
| `--text` | `#2f2a4a` | ข้อความหลัก |
| `--text-2` | `#6f6893` | ข้อความรอง |
| `--text-3` | `#8a83a8` | ป้ายกำกับ หัวตาราง |
| `--text-4` | `#b7b1d6` | หมายเลขแถว ตัวช่วยจาง |
| `--primary` | `#6a4fd8` | แถบนำทาง ปุ่ม segment ที่เลือก เส้นวันนี้ |
| `--primary-dark` | `#4e37b0` | ข้อความบนพื้น primary-light ชื่อสัปดาห์ |
| `--primary-light` | `#e6e1fb` | พื้น pill รอง |
| `--primary-tint` | `#d9d2f7` | ข้อความเมนูที่ไม่ได้เลือกบนพื้นม่วง |
| `--ink` | `#2f2a4a` | ปุ่มหลัก (เข้ม) |
| `--critical` | `#e0457b` | แถบงาน critical เส้นลูกศร critical |
| `--critical-text` | `#b8285a` | ข้อความ float = 0 ข้อความบน critical-bg |
| `--critical-bg` | `#ffe0ec` | ชิป critical กล่อง CPM |
| `--task` | `#8fd3c7` | แถบงานทั่วไป ภาระงานเต็ม |
| `--task-text` | `#1f4d45` | ข้อความบนแถบงานทั่วไป |
| `--milestone` | `#ffd166` | เพชร milestone โลโก้ |
| `--warn-bg` | `#fff3d6` | กล่องเตือนเกินกำลัง |
| `--warn-text` | `#9a6b00` | ข้อความเตือน |
| `--warn-icon` | `#c98a00` | ไอคอนเตือน |
| `--link` | `#b7b1d6` | เส้นลูกศร dependency ทั่วไป เส้นประ float |
| `--success` | `#1f9e89` | สถานะเสร็จ |

สีทรัพยากร (วนใช้ตามลำดับเมื่อสร้างใหม่ ผู้ใช้เปลี่ยนได้)

`#6a4fd8` `#e0457b` `#1f9e89` `#f28c28` `#2e86de` `#a1519c` `#8a83a8`

### 2.2 ตัวอักษร

| Token | ขนาด / น้ำหนัก / บรรทัด | ใช้กับ |
|---|---|---|
| `--font` | Kanit, "Segoe UI", Tahoma, sans-serif | ทั้งระบบ |
| `--fs-h1` | 20px / 600 / 1.2 | ชื่อหน้า |
| `--fs-h2` | 18px / 600 / 1.3 | ชื่อแผง ชื่องานในแผง |
| `--fs-h3` | 14px / 600 / 1.4 | หัวการ์ด |
| `--fs-kpi` | 24px / 600 / 1.2 | ตัวเลขสรุป |
| `--fs-body` | 13px / 400 / 1.5 | ข้อความทั่วไป ตาราง |
| `--fs-label` | 12px / 500 / 1.4 | ป้ายฟิลด์ หัวตาราง ชิป |
| `--fs-caption` | 11px / 400 / 1.4 | เลขวัน ข้อความในแถบงาน |
| `--fs-micro` | 10px / 600 / 1 | ตัวเลข % ในช่องความร้อน |

ตัวเลขในตารางใช้ `font-variant-numeric: tabular-nums` เสมอ

### 2.3 ระยะและขนาด

| Token | ค่า |
|---|---|
| `--sp-1` … `--sp-6` | 4, 8, 12, 16, 20, 24px |
| `--page-pad` | 16px (มือถือ 12px) |
| `--gap` | 16px ระหว่างการ์ด, 12px ภายในกลุ่ม |
| `--h-header` | 60px (มือถือ 52px) |
| `--h-control` | 40px ปุ่มและ segment |
| `--h-control-sm` | 36px ปุ่มรอง |
| `--h-chip` | 30px |
| `--h-input` | 38px |
| `--h-row` | 44px แถวตารางและแถว Gantt (มือถือ 40px) |
| `--h-bar` | 26px แถบงาน |
| `--w-day` | 36px ต่อวันใน zoom วัน (มือถือ 28px) |
| `--w-week` | 84px ต่อสัปดาห์ใน zoom สัปดาห์ |
| `--w-month` | 120px ต่อเดือนใน zoom เดือน |
| `--w-namecol` | 220px คอลัมน์ชื่องาน (มือถือ 120px) |
| `--w-panel` | 320px แผงงานด้านขวา |
| `--tap-min` | 44px ขนาดพื้นที่แตะต่ำสุดบนมือถือ |

### 2.4 มุมโค้ง

| Token | ค่า | ใช้กับ |
|---|---|---|
| `--r-pill` | 999px | ปุ่ม ชิป แท็บ แถบงาน segment |
| `--r-card` | 18px | การ์ด แผง header bar |
| `--r-kpi` | 16px | การ์ดตัวเลขสรุป |
| `--r-input` | 12px | ช่องกรอก แถว dependency |
| `--r-cell` | 6px | ช่องความร้อน |
| `--r-ms` | 4px | เพชร milestone |
| `--r-sheet` | 24px 24px 0 0 | bottom sheet บนมือถือ |

### 2.5 เงา

| Token | ค่า | ใช้กับ |
|---|---|---|
| `--sh-card` | `0 2px 8px rgba(47,42,74,.06)` | การ์ด แผง |
| `--sh-btn` | `0 6px 16px rgba(47,42,74,.18)` | ปุ่มหลัก |
| `--sh-float` | `0 -4px 24px rgba(47,42,74,.14)` | bottom sheet drawer |
| `--sh-seg` | `0 1px 2px rgba(47,42,74,.06)` | segment control |

### 2.6 การเคลื่อนไหว

| Token | ค่า |
|---|---|
| `--ease` | `cubic-bezier(.2,.8,.2,1)` |
| `--t-fast` | 120ms hover, focus |
| `--t-base` | 200ms เปิดปิดแผง เปลี่ยน segment |
| `--t-slow` | 320ms bottom sheet, drawer |

ปิดทั้งหมดเมื่อ `prefers-reduced-motion: reduce`

## 3. Components

ทุก component อยู่ใน `frontend/src/shared/ui/` ยกเว้นที่ระบุว่าเป็นของ feature

### 3.1 พื้นฐาน

| Component | Variants | ข้อกำหนด |
|---|---|---|
| `Button` | primary (พื้น ink ตัวขาว เงา), secondary (พื้นขาว), ghost (พื้น surface-3), danger-ghost (ตัว critical-text) | สูง 40 / 36 (sm) โค้ง pill ไอคอน 14px ช่องไฟ 6px |
| `IconButton` | default, on-dark | 32px วงกลม พื้น surface-3 |
| `Chip` | critical (critical-bg), soft (ขาว), primary (primary-light), warn | สูง 30 โค้ง pill |
| `Pill` | primary (พื้นม่วงตัวขาว), soft (primary-light) | สูง 24 สำหรับ FS / SS / % ในแถว |
| `Segment` | — | พื้นขาว padding 4 ตัวเลือกที่เลือกพื้น primary |
| `Tabs` | on-dark (ใน header bar) | สูง 38 ที่เลือกพื้นขาวตัว primary-dark |
| `Avatar` | 22 / 34px | วงกลม สีทรัพยากร ตัวอักษรแรกสีขาว |
| `Input`, `Select`, `NumberInput`, `DateInput` | default, readonly | สูง 38 พื้น surface-3 โค้ง 12 ไม่มีเส้นขอบ focus แสดง ring 2px primary |
| `Toggle` | — | ราง 34×20 ปุ่ม 16 เปิดพื้น primary |
| `ProgressBar` | primary, task | สูง 8 – 10 โค้ง pill |
| `Card` | default, kpi (crit / warn) | ดู tokens |
| `Tooltip` | — | พื้น ink ตัวขาว โค้ง 8 |
| `Toast` | success, error, warn | มุมล่างกลาง (มือถือ) / ล่างขวา (desktop) |
| `Dialog` | confirm | การ์ด 420px กลางจอ; มือถือกลายเป็น bottom sheet |
| `BottomSheet` | half, full | มือถือเท่านั้น โค้งบน 24 มีที่จับลาก |
| `Drawer` | left | ซ้อนจากซ้าย กว้าง 400 (desktop) / เต็มจอ (มือถือ) |
| `EmptyState` | — | ภาพประกอบเรียบ 1 บรรทัดอธิบาย 1 ปุ่ม |

### 3.2 ของ feature

| Component | อยู่ที่ | หมายเหตุ |
|---|---|---|
| `HeaderBar` | `app/layout` | โลโก้ project switcher แท็บ (Gantt / ปฏิทิน / ทรัพยากร) avatar; มือถือเหลือโลโก้ ชื่อโปรเจกต์ ปุ่มเมนู |
| `BottomNav` | `app/layout` | มือถือเท่านั้น 3 แท็บหลัก + ปุ่มเพิ่มงานตรงกลาง |
| `GanttToolbar` | `features/gantt` | ปุ่มรายการงาน segment zoom ชิปสรุป ปุ่มเพิ่มงาน |
| `GanttTimeline` | `features/gantt` | หัววัน / สัปดาห์ / เดือน แถว แถบงาน ลูกศร เส้นวันนี้ |
| `TaskBar` | `features/gantt` | pill สูง 26 มี progress overlay ที่จับซ้าย / ขวา / ปลายสำหรับ dependency |
| `DependencyArrow` | `features/gantt` | SVG path เส้น 2px หัวลูกศร 6px |
| `TaskNameColumn` | `features/gantt` | 220px ชื่อ + จุดสีสถานะ |
| `TaskListDrawer` | `features/gantt` | ตารางเต็มใน Drawer |
| `TaskPanel` | `features/tasks` | แผงขวา 320 (desktop) / bottom sheet (มือถือ) |
| `DependencyRow` | `features/dependencies` | ชื่องาน Pill ประเภท Pill lag ปุ่มลบ |
| `CpmBox` | `features/scheduling` | พื้น critical-bg ตาราง 4 ช่อง ES EF LS LF |
| `MonthCalendar`, `WeekByResource` | `features/calendar` | ชิปงานสูง 22 สีตามทรัพยากร |
| `OverloadBadge` | `features/assignments` | วงกลมแดง 18px ตัวเลข % |
| `WorkloadBar`, `WorkloadHeat` | `features/resources` | แถบ pill 10px / ช่อง 28px โค้ง 6 |
| `ProjectCard` | `features/projects` | การ์ดสูง 120 ชื่อ ช่วงวัน progress ชิป critical |

## 4. สถานะของ component

| สถานะ | กติกา |
|---|---|
| hover | พื้นเข้มขึ้น 4% (desktop เท่านั้น) |
| focus-visible | ring 2px `--primary` ห่าง 2px |
| active / pressed | scale .98 |
| disabled | opacity .45 ไม่มีเงา |
| selected (แถบงาน แถว) | ring 2px `--primary` และพื้นแถว `--surface-2` |
| loading | skeleton พื้น `--surface-3` เลื่อนแสงจาง |
| error (ช่องกรอก) | ring 2px `--critical` ข้อความช่วยสี `--critical-text` |

## 5. Iconography

ไอคอนเส้น (stroke 1.8, ปลายมน) ขนาด 18px ในเมนู 14px ในปุ่ม 24px ในแท็บล่างมือถือ ใช้ชุด Lucide เพื่อความสม่ำเสมอ ไม่ใช้อีโมจิ

## 6. Responsive Breakpoints

| ชื่อ | ช่วง | โครง |
|---|---|---|
| `mobile` | < 768px | BottomNav, ไม่มี HeaderBar แท็บ, TaskPanel เป็น BottomSheet, Gantt คอลัมน์ชื่อ 120px และ zoom เริ่มที่สัปดาห์, ปฏิทินแสดงเฉพาะสัปดาห์ |
| `tablet` | 768 – 1023px | HeaderBar เต็ม, Gantt ซ่อนคอลัมน์ชื่อเป็นปุ่มเปิด, TaskPanel เป็น Drawer ขวา 360 |
| `desktop` | >= 1024px | Layout 2 ตามแบบ |

รายละเอียดหน้าจอมือถืออยู่ใน [ui-design.md](ui-design.md) ส่วนที่ 5

## 7. การเข้าถึง

- คอนทราสต์ข้อความบนพื้นทุกคู่ผ่าน WCAG AA (ตรวจแล้ว: ขาวบน `#6a4fd8` 5.9:1, `#b8285a` บน `#ffe0ec` 5.4:1, `#1f4d45` บน `#8fd3c7` 7.2:1)
- Critical path ไม่พึ่งสีอย่างเดียว มีจุดสีในตารางและข้อความ Float = 0 กำกับ
- แถบงานและปุ่มทุกอันเข้าถึงด้วยคีย์บอร์ด ลูกศรซ้ายขวาเลื่อนงานทีละวันเมื่อโฟกัสแถบ
- ขนาดแตะบนมือถือไม่ต่ำกว่า 44px
