# แผนงาน – Project Scheduler

Web app สำหรับวางแผนโปรเจกต์: Gantt + Calendar + resource assignment + critical path (CPM) + schedule buffer (Critical Chain) ใช้งานคนเดียว เก็บข้อมูลเป็นไฟล์ JSON UI ภาษาไทย

## เอกสารที่ต้องอ่านก่อนแก้อะไร

| เรื่อง | ไฟล์ |
|---|---|
| Feature ทั้งหมด, data model, API, กติกาที่ปรับได้ | `docs/features.md` |
| Spec หน้าจอ desktop / tablet / มือถือ, คีย์ลัด | `docs/ui-design.md` |
| Design tokens, component, สถานะ, breakpoint | `docs/design-system.md` และ `frontend/src/shared/styles/tokens.css` |
| แผนงานและลำดับ phase | `docs/plan.md` |
| Mockup ที่ตกลงแล้ว (แบบ D สดใส เป็นมิตร + Layout 2 ไทม์ไลน์เต็มจอ) | canvas ใน `design/` (build ด้วย `node build-*.mjs`) |

ถ้าสิ่งที่ทำเบี่ยงจากเอกสาร ให้แก้เอกสารในการเปลี่ยนแปลงเดียวกัน

## กติกาสำคัญ: ทดสอบอัตโนมัติเต็มรูปแบบ

โปรเจกต์นี้พัฒนาโดย AI ตลอดทาง ผู้ใช้ไม่ทดสอบด้วยมือ ดังนั้น **ทุกงานต้องมี automated test ที่พิสูจน์ว่าใช้งานได้ ก่อนถือว่าเสร็จ** ไม่มีข้อยกเว้น

- **Backend**: pytest ทุก feature มี test ของ service / engine (pure logic) และ test ของ API ผ่าน `TestClient` ใช้ fixture `client` และ `data_dir` จาก `tests/conftest.py` เสมอ ห้ามแตะ `./data` จริง
- **Scheduling engine** (`app/features/scheduling`): เป็น pure Python ไม่ import FastAPI ต้องมี test ครอบคลุม forward/backward pass, float, critical path, dependency ทั้ง 4 ประเภทพร้อม lag บวกและลบ, วันหยุด, constraint, summary rollup, buffer ทั้ง 3 วิธี และกรณีขอบ เช่น cycle, milestone, งานเดียว
- **Frontend unit/component**: Vitest + Testing Library ไฟล์ `*.test.tsx` อยู่ข้างไฟล์ที่ทดสอบ ใช้ `renderWithProviders` จาก `src/test/render.tsx` mock network ด้วย `vi.stubGlobal('fetch', …)` ทดสอบผ่าน role / text ที่ผู้ใช้เห็น ไม่ทดสอบ implementation detail
- **E2E**: Playwright ใน `frontend/e2e/` รันทั้ง desktop และ mobile viewport ทุก user flow หลักใน `docs/features.md` ต้องมี e2e อย่างน้อยหนึ่งเส้นทาง (สร้างโปรเจกต์ → เพิ่มงาน → ผูก dependency → เห็น critical path → มอบหมาย resource → เห็นเตือนเกินกำลัง)
- **ก่อนจบทุกงาน** รัน `npm test` ที่ root (backend + frontend unit) และ `npm run test:e2e` เมื่อแตะ UI flow ถ้าแดงต้องแก้ให้เขียว ห้ามข้ามหรือ skip test เพื่อให้ผ่าน
- **เมื่อพบบั๊ก** เขียน test ที่ล้มเหลวก่อนแล้วค่อยแก้
- **Performance**: มี test ยืนยันว่า schedule 500 งานคำนวณ < 100 ms (features.md ข้อ 5)

รายงานผลตามจริง ถ้า test ใดยังไม่ผ่านหรือยังไม่ได้เขียน ให้บอกชัดเจน

## คำสั่ง

```
npm run dev          # รัน backend :8000 + frontend :5173 พร้อมกัน
npm test             # pytest + vitest
npm run test:e2e     # playwright (เปิด server ให้เองถ้ายังไม่รัน)
npm run lint         # ruff + oxlint
```

หรือใช้ VS Code: Terminal → Run Task → `dev: all`, `test: all`, `test: e2e (playwright)`

Backend ใช้ venv ที่ `backend/.venv` (Python 3.11) เรียกผ่าน `backend/.venv/Scripts/python.exe -m …` เสมอ ไม่พึ่ง `python` ใน PATH

## โครงสร้าง (feature-based)

```
backend/app/
  core/            config, storage (atomic write + lock + backup), errors
  features/<name>/ router.py  schemas.py  service.py  repository.py
  main.py          register routers
backend/tests/     test_<feature>_*.py, conftest.py
frontend/src/
  app/             App, routes, layout (HeaderBar, BottomNav)
  features/<name>/ api/ components/ hooks/ types.ts + *.test.tsx
  shared/ui        design-system components
  shared/api       fetch client, hooks
  shared/styles    tokens.css, global.css
  test/            setup, renderWithProviders
frontend/e2e/      playwright specs
data/              JSON files (ignored by git)
```

ชื่อ feature module ต้องตรงกันทั้งสองฝั่ง: projects, tasks, dependencies, scheduling, gantt (fe only), calendar (fe only), resources, assignments, settings, io, history

## ข้อตกลงด้านโค้ด

- Python: type hints ทุกฟังก์ชัน, pydantic v2 schemas, วันที่เป็น `datetime.date` ภายใน และ ISO `YYYY-MM-DD` ที่ API, ruff ผ่าน
- TypeScript: strict, ไม่ใช้ `any`, ใช้ TanStack Query สำหรับข้อมูล server และ Zustand สำหรับ UI state เท่านั้น, alias `@/` = `src/`
- สไตล์: ใช้ CSS variables จาก tokens.css เท่านั้น ห้าม hardcode สี ขนาด หรือมุมโค้ง ยึด `docs/design-system.md`
- UI text ภาษาไทย, วันที่แสดงเป็น พ.ศ. แต่เก็บและส่งเป็น ค.ศ. ISO
- ไม่เก็บ start/end ของงานลงไฟล์ ให้ engine คำนวณทุกครั้ง (features.md 2.2)
- Buffer default คือ Critical Chain 50% (features.md 3.13) ทุกจุดที่กรอกระยะเวลาต้องสื่อว่า "กรอกแบบไม่เผื่อ"
- Commit เฉพาะเมื่อผู้ใช้สั่ง
