"""Single-user login (docs/features.md AUTH-1).

Credentials live in config (env or backend/config.json). A successful login sets an
HttpOnly cookie carrying a signed token `<expiry>.<hmac>`; no server-side session store
is needed. Failed attempts are throttled per client address.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import threading
import time

from app.core.config import Settings

COOKIE_NAME = "phaengan_session"
MAX_FAILURES = 5
FAILURE_WINDOW_S = 60


def check_credentials(cfg: Settings, username: str, password: str) -> bool:
    ok_user = secrets.compare_digest(username.encode("utf-8"), cfg.auth_username.encode("utf-8"))
    ok_pass = secrets.compare_digest(password.encode("utf-8"), cfg.auth_password.encode("utf-8"))
    return ok_user and ok_pass


def _sign(cfg: Settings, payload: str) -> str:
    key = hashlib.sha256(cfg.session_secret.encode("utf-8")).digest()
    return hmac.new(key, payload.encode("utf-8"), hashlib.sha256).hexdigest()


def issue_token(cfg: Settings, now: float | None = None) -> str:
    exp = int((now if now is not None else time.time()) + cfg.session_hours * 3600)
    payload = f"{exp}.{cfg.auth_username}"
    return f"{payload}.{_sign(cfg, payload)}"


def verify_token(cfg: Settings, token: str | None, now: float | None = None) -> bool:
    if not token:
        return False
    try:
        exp_s, user, sig = token.rsplit(".", 2)
        exp = int(exp_s)
    except ValueError:
        return False
    if (now if now is not None else time.time()) > exp:
        return False
    if user != cfg.auth_username:  # credentials changed -> old sessions die
        return False
    return hmac.compare_digest(sig, _sign(cfg, f"{exp_s}.{user}"))


class LoginThrottle:
    """At most MAX_FAILURES wrong passwords per address per minute."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._failures: dict[str, list[float]] = {}

    def _prune(self, key: str, now: float) -> list[float]:
        recent = [t for t in self._failures.get(key, []) if now - t < FAILURE_WINDOW_S]
        if recent:
            self._failures[key] = recent
        else:
            self._failures.pop(key, None)
        return recent

    def blocked(self, key: str, now: float | None = None) -> bool:
        now = now if now is not None else time.time()
        with self._lock:
            return len(self._prune(key, now)) >= MAX_FAILURES

    def record_failure(self, key: str, now: float | None = None) -> None:
        now = now if now is not None else time.time()
        with self._lock:
            self._failures.setdefault(key, []).append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)


throttle = LoginThrottle()
