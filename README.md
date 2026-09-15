# แผนงาน (Project Scheduler)

Web app วางแผนโปรเจกต์: Gantt, ปฏิทินตามทรัพยากร, critical path และสำรองเวลาแบบ Critical Chain
React + TypeScript (Vite) · FastAPI (Python 3.11) · เก็บข้อมูลเป็นไฟล์ JSON

## เริ่มใช้งาน

```bash
# ครั้งแรก
cd backend && python -m venv .venv && .venv\Scripts\python -m pip install -r requirements.txt && cd ..
cd frontend && npm install && npx playwright install chromium && cd ..
npm install

# รัน
npm run dev      # backend http://127.0.0.1:8000  frontend http://localhost:5173
npm test         # pytest + vitest
npm run test:e2e # playwright
```

เข้าสู่ระบบครั้งแรกด้วย `admin` / `admin` เปลี่ยนได้ที่ `backend/config.json` (คัดลอกจาก `config.example.json`) หรือตัวแปรแวดล้อม `AUTH_USERNAME` / `AUTH_PASSWORD`

นำขึ้นเว็บสาธารณะ: ดู [docs/deploy.md](docs/deploy.md) (`npm run build && npm run start` หรือ `docker compose up -d --build` พร้อม HTTPS อัตโนมัติ)

ใน VS Code ใช้ Terminal → Run Task → `dev: all`

## เอกสาร

- [docs/features.md](docs/features.md) feature, data model, API
- [docs/ui-design.md](docs/ui-design.md) spec หน้าจอ
- [docs/design-system.md](docs/design-system.md) tokens และ component
- [docs/plan.md](docs/plan.md) แผนการพัฒนา
- [CLAUDE.md](CLAUDE.md) กติกาสำหรับ AI ที่พัฒนาโปรเจกต์นี้
