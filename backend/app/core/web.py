"""HTTP plumbing for a public deployment: auth gate, security headers, SPA hosting.

Kept out of `main.py` so the app factory stays a plain list of routers.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.staticfiles import StaticFiles

from app.core.config import settings
from app.features.auth.service import COOKIE_NAME, verify_token

PUBLIC_PATHS = {"/api/health", "/api/auth/login", "/api/auth/me"}


class AuthGateMiddleware(BaseHTTPMiddleware):
    """Every /api route except the public ones needs a valid session cookie."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path
        if path.startswith("/api") and path not in PUBLIC_PATHS and request.method != "OPTIONS":
            cfg = settings()
            if not cfg.auth_disabled and not verify_token(cfg, request.cookies.get(COOKIE_NAME)):
                return JSONResponse(
                    status_code=401,
                    content={
                        "error": {
                            "code": "unauthorized",
                            "message": "ยังไม่ได้เข้าสู่ระบบ",
                            "details": None,
                        }
                    },
                )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
        )
        if settings().cookie_secure:  # only meaningful behind HTTPS
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        if request.url.path.startswith("/api"):
            response.headers.setdefault("Cache-Control", "no-store")
        return response


def mount_spa(app: FastAPI, static_dir: Path) -> None:
    """Serve the built frontend: hashed assets with long cache, everything else -> index.html."""
    assets = static_dir / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")
    index = static_dir / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> Response:
        if full_path.startswith("api/"):
            return JSONResponse(
                status_code=404,
                content={"error": {"code": "not_found", "message": full_path, "details": None}},
            )
        candidate = (static_dir / full_path).resolve()
        if full_path and candidate.is_file() and static_dir.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
