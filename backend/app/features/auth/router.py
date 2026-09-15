from __future__ import annotations

from fastapi import APIRouter, Request, Response, status
from pydantic import Field

from app.core.config import settings
from app.core.errors import AppError
from app.core.models import CamelModel

from . import service

router = APIRouter(prefix="/auth", tags=["auth"])


class Unauthorized(AppError):
    status_code = 401
    code = "unauthorized"


class TooManyAttempts(AppError):
    status_code = 429
    code = "too_many_attempts"


class LoginBody(CamelModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=200)


class MeOut(CamelModel):
    username: str
    auth_disabled: bool = False


def _client_key(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else None) or (
        request.client.host if request.client else "?"
    )


@router.post("/login", response_model=MeOut)
def login(body: LoginBody, request: Request, response: Response) -> MeOut:
    cfg = settings()
    key = _client_key(request)
    if service.throttle.blocked(key, limit=cfg.login_max_failures):
        raise TooManyAttempts("ลองผิดหลายครั้งเกินไป รอ 1 นาทีแล้วลองใหม่")
    if not service.check_credentials(cfg, body.username, body.password):
        service.throttle.record_failure(key)
        raise Unauthorized("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
    service.throttle.reset(key)
    response.set_cookie(
        service.COOKIE_NAME,
        service.issue_token(cfg),
        max_age=cfg.session_hours * 3600,
        httponly=True,
        samesite="lax",
        secure=cfg.cookie_secure,
        path="/",
    )
    return MeOut(username=cfg.auth_username)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> Response:
    cfg = settings()
    out = Response(status_code=status.HTTP_204_NO_CONTENT)
    out.delete_cookie(service.COOKIE_NAME, path="/", samesite="lax", secure=cfg.cookie_secure)
    return out


@router.get("/me", response_model=MeOut)
def me(request: Request) -> MeOut:
    cfg = settings()
    if cfg.auth_disabled:
        return MeOut(username=cfg.auth_username, auth_disabled=True)
    if not service.verify_token(cfg, request.cookies.get(service.COOKIE_NAME)):
        raise Unauthorized("ยังไม่ได้เข้าสู่ระบบ")
    return MeOut(username=cfg.auth_username)
