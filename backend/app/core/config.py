"""Runtime configuration.

All paths are resolved relative to the repository root so the app works the same
whether started from `backend/` or from the repo root. `DATA_DIR` can be overridden
with the environment variable of the same name (tests point it at a temp folder).

Settings come from, in order of precedence:
1. environment variables (`AUTH_USERNAME`, `AUTH_PASSWORD`, `SESSION_SECRET`, …)
2. `backend/config.json` (copy `config.example.json`; git-ignored)
3. built-in defaults (a single local user `admin` / `admin` – change it before going public)
"""

from __future__ import annotations

import json
import os
import secrets
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
CONFIG_FILE = REPO_ROOT / "backend" / "config.json"


def data_dir() -> Path:
    """Folder holding all JSON data files. Created on first use."""
    raw = os.environ.get("DATA_DIR")
    path = Path(raw) if raw else REPO_ROOT / "data"
    path.mkdir(parents=True, exist_ok=True)
    (path / "projects").mkdir(exist_ok=True)
    return path


APP_TITLE = "แผนงาน API"
APP_VERSION = "0.1.0"


@dataclass(frozen=True)
class Settings:
    auth_username: str
    auth_password: str
    session_secret: str
    session_hours: int
    cookie_secure: bool  # only send the session cookie over HTTPS (set on a public site)
    public_origin: str | None  # e.g. https://plan.example.com – extra CORS origin
    static_dir: Path | None  # built frontend (frontend/dist) served by the API when present
    auth_disabled: bool  # tests/dev only: every request is treated as logged in


def _file_config() -> dict[str, object]:
    raw = os.environ.get("CONFIG_FILE")
    path = Path(raw) if raw else CONFIG_FILE
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:  # a broken config must fail loudly, not silently
        raise RuntimeError(f"config.json is not valid JSON: {e}") from e


def _pick(env: str, file_key: str, cfg: dict[str, object], default: str) -> str:
    val = os.environ.get(env)
    if val is not None and val != "":
        return val
    fv = cfg.get(file_key)
    return str(fv) if fv is not None and fv != "" else default


def _truthy(v: str) -> bool:
    return v.strip().lower() in {"1", "true", "yes", "on"}


@lru_cache(maxsize=1)
def settings() -> Settings:
    cfg = _file_config()
    static_raw = _pick("STATIC_DIR", "staticDir", cfg, "")
    static_dir = Path(static_raw) if static_raw else REPO_ROOT / "frontend" / "dist"
    if not static_dir.is_absolute():
        static_dir = REPO_ROOT / static_dir
    return Settings(
        auth_username=_pick("AUTH_USERNAME", "username", cfg, "admin"),
        auth_password=_pick("AUTH_PASSWORD", "password", cfg, "admin"),
        # a random secret per process is fine for one server: sessions simply reset on restart
        session_secret=_pick("SESSION_SECRET", "sessionSecret", cfg, "") or secrets.token_hex(32),
        session_hours=int(_pick("SESSION_HOURS", "sessionHours", cfg, "168")),
        cookie_secure=_truthy(_pick("COOKIE_SECURE", "cookieSecure", cfg, "false")),
        public_origin=_pick("PUBLIC_ORIGIN", "publicOrigin", cfg, "") or None,
        static_dir=static_dir if static_dir.is_dir() else None,
        auth_disabled=_truthy(_pick("AUTH_DISABLED", "authDisabled", cfg, "false")),
    )


def reset_settings_cache() -> None:
    """Tests change environment variables between cases."""
    settings.cache_clear()
