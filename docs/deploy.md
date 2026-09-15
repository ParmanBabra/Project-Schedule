# การติดตั้งใช้งานจริง (public www)

แอปเป็น process เดียว: FastAPI ให้บริการ API และไฟล์ React ที่ build แล้ว (`frontend/dist`) ข้อมูลเป็นไฟล์ JSON ในโฟลเดอร์เดียว การเข้าถึงทุกอย่างต้องล็อกอินด้วยผู้ใช้เดียวที่ตั้งไว้ใน config

## 1. ตั้งค่า (config)

ลำดับความสำคัญ: ตัวแปรแวดล้อม > `backend/config.json` > ค่าเริ่มต้น (`admin` / `admin` สำหรับเครื่องตัวเองเท่านั้น)

| env | key ใน config.json | ความหมาย |
|---|---|---|
| `AUTH_USERNAME` / `AUTH_PASSWORD` | `username` / `password` | บัญชีเดียวที่ล็อกอินได้ |
| `SESSION_SECRET` | `sessionSecret` | กุญแจเซ็นคุกกี้ session ถ้าไม่ตั้งจะสุ่มใหม่ทุกครั้งที่รีสตาร์ท (ทุกคนหลุดล็อกอิน) |
| `SESSION_HOURS` | `sessionHours` | อายุ session ค่าเริ่มต้น 168 ชั่วโมง (7 วัน) |
| `COOKIE_SECURE` | `cookieSecure` | `true` เมื่ออยู่หลัง HTTPS (บังคับสำหรับเว็บสาธารณะ) |
| `PUBLIC_ORIGIN` | `publicOrigin` | origin ของเว็บ เช่น `https://plan.example.com` (CORS) |
| `STATIC_DIR` | `staticDir` | โฟลเดอร์ frontend ที่ build แล้ว ค่าเริ่มต้น `frontend/dist` |
| `DATA_DIR` | – | โฟลเดอร์ข้อมูล ค่าเริ่มต้น `data/` |
| `CONFIG_FILE` | – | path ของ config.json อื่น |
| `AUTH_DISABLED` | `authDisabled` | ปิดล็อกอิน ใช้เฉพาะเครื่องตัวเอง/ทดสอบ |
| `AUTH_MAX_FAILURES` | `loginMaxFailures` | จำนวนครั้งที่ใส่รหัสผิดได้ต่อนาทีต่อ IP ก่อนโดน 429 (ค่าเริ่มต้น 5) |

ตัวอย่างไฟล์: [`backend/config.example.json`](../backend/config.example.json) (คัดลอกเป็น `backend/config.json` ซึ่งถูก git-ignore)

## 2. รันบนเครื่องเดียวแบบ production (ไม่ใช้ Docker)

```bash
npm run build          # สร้าง frontend/dist
cp backend/config.example.json backend/config.json   # แก้ username/password/sessionSecret
npm run start          # http://0.0.0.0:8000 ให้บริการทั้งเว็บและ API
```

ตั้ง reverse proxy (nginx/Caddy/IIS) ให้ส่ง HTTPS มาที่พอร์ต 8000 และตั้ง `cookieSecure: true`

## 2.1 เปิดให้คนนอกเข้าชั่วคราวด้วย ngrok

ไม่ต้องมีเซิร์ฟเวอร์หรือโดเมน เหมาะกับการให้คนอื่นดู/ใช้ชั่วคราว (ต้องติดตั้ง ngrok และ `ngrok config add-authtoken <token>` ครั้งแรก)

```bash
npm run build                 # ครั้งแรก หรือเมื่อแก้ frontend
set COOKIE_SECURE=true        # PowerShell: $env:COOKIE_SECURE="true"  (ngrok เป็น HTTPS)
npm run start                 # API + เว็บ ที่ 127.0.0.1:8000 อ่าน IP จริงจาก header ของ ngrok
npm run tunnel                # เทอร์มินัลที่ 2: ได้ URL https://xxxx.ngrok-free.app
```

ใช้ URL จาก ngrok ได้เลย ล็อกอินด้วยบัญชีใน config เหมือนเดิม ไม่ต้องตั้ง `PUBLIC_ORIGIN` เพราะเว็บกับ API อยู่ origin เดียวกัน ถ้าใช้ free plan URL จะเปลี่ยนทุกครั้งที่เปิดใหม่ (ใช้ `ngrok http 8000 --domain=<ชื่อคงที่>` เมื่อมี static domain)

## 3. Docker + HTTPS อัตโนมัติ (แนะนำสำหรับ VPS)

ต้องมี: โดเมนชี้ A record มาที่เครื่อง, เปิดพอร์ต 80/443, ติดตั้ง Docker

```bash
cp .env.example .env    # ใส่ DOMAIN, AUTH_USERNAME, AUTH_PASSWORD, SESSION_SECRET
docker compose up -d --build
docker compose logs -f caddy   # รอจน Caddy ออกใบรับรอง Let's Encrypt
```

- ข้อมูลอยู่ใน volume `data` (สำรองด้วย `docker run --rm -v phaengan_data:/data -v $PWD:/backup alpine tar czf /backup/data.tgz /data`)
- อัปเดตเวอร์ชัน: `git pull && docker compose up -d --build`
- ตัว image ตั้ง `COOKIE_SECURE=true` และรัน uvicorn ด้วย `--proxy-headers` เพื่ออ่าน IP จริงจาก Caddy (ใช้จำกัดการเดารหัสผ่าน)

## 4. สิ่งที่ระบบทำให้เมื่อออกสาธารณะ

- ทุก `/api/*` ยกเว้น `health`, `auth/login`, `auth/me` ตอบ 401 ถ้าไม่มีคุกกี้ session ที่ถูกต้อง
- คุกกี้ `HttpOnly` + `SameSite=Lax` (+ `Secure` เมื่อ `cookieSecure`) เซ็นด้วย HMAC-SHA256 หมดอายุตาม `sessionHours` และใช้ไม่ได้ทันทีที่เปลี่ยน username
- เดารหัสผ่านผิด 5 ครั้งใน 1 นาทีต่อ IP → 429 หนึ่งนาที
- ส่วนหัวความปลอดภัย: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: no-store` สำหรับ API, HSTS เมื่อ HTTPS
- ปิดหน้า `/docs` และ `/redoc`; `/api/health` ไม่เปิดเผย path ของเครื่อง
- gzip สำหรับ response ใหญ่; ไฟล์ใน `assets/` (มี hash ในชื่อ) cache ได้ยาว ส่วน `index.html` ไม่ cache

## 5. Hot reload ตอนพัฒนา

- backend: `uvicorn --reload --reload-dir app --reload-delay 0.15` เฝ้าเฉพาะโค้ดใน `app/` (ไม่ดู `data/`, `.venv`) จึงรีสตาร์ทเร็วและไม่รีสตาร์ทตอนบันทึกข้อมูล
- frontend: Vite HMR + `server.warmup` อุ่นกราฟหน้าหลักไว้ตั้งแต่เริ่ม ให้การแก้ครั้งแรกอัปเดตทันที
- ทั้งสองอย่างเปิดด้วย `npm run dev` หรือ VS Code task `dev: all`
