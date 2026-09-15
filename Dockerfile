# แผนงาน – single image: FastAPI serves the API and the built React app.
# Build:  docker build -t phaengan .
# Run:    docker run -p 8000:8000 -v phaengan-data:/data -e AUTH_USERNAME=... -e AUTH_PASSWORD=... phaengan

# ---- 1. build the frontend
FROM node:22-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 2. runtime
FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    DATA_DIR=/data STATIC_DIR=/app/frontend/dist \
    COOKIE_SECURE=true
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/app backend/app
COPY --from=web /src/frontend/dist frontend/dist
RUN useradd -r -u 10001 phaengan && mkdir -p /data && chown phaengan /data
USER phaengan
VOLUME ["/data"]
EXPOSE 8000
WORKDIR /app/backend
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/api/health')" || exit 1
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
