"""AUTH-1: single-user login from config, cookie session, gate on /api, throttle, SPA hosting."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, reset_settings_cache, settings
from app.features.auth import service


def _settings(**over) -> Settings:
    base = dict(
        auth_username="u",
        auth_password="p",
        session_secret="s",
        session_hours=1,
        cookie_secure=False,
        public_origin=None,
        static_dir=None,
        auth_disabled=False,
        login_max_failures=5,
    )
    base.update(over)
    return Settings(**base)


def test_token_roundtrip_expiry_and_tamper():
    cfg = _settings()
    tok = service.issue_token(cfg, now=1000)
    assert service.verify_token(cfg, tok, now=1000 + 3599)
    assert not service.verify_token(cfg, tok, now=1000 + 3601)
    assert not service.verify_token(cfg, tok[:-1] + ("0" if tok[-1] != "0" else "1"), now=1000)
    assert not service.verify_token(_settings(session_secret="other"), tok, now=1000)
    assert not service.verify_token(_settings(auth_username="someone"), tok, now=1000)
    assert not service.verify_token(cfg, None) and not service.verify_token(cfg, "garbage")


def test_throttle_blocks_after_five_failures_within_a_minute():
    t = service.LoginThrottle()
    for i in range(5):
        assert not t.blocked("ip", now=100 + i)
        t.record_failure("ip", now=100 + i)
    assert t.blocked("ip", now=105)
    assert not t.blocked("ip", now=100 + 61)  # window passed
    assert not t.blocked("other", now=105)


def test_api_is_locked_until_login_and_cookie_session_works(client: TestClient, auth_env: dict):
    # health is public, everything else is not
    assert client.get("/api/health").status_code == 200
    res = client.get("/api/projects")
    assert res.status_code == 401 and res.json()["error"]["code"] == "unauthorized"
    assert client.get("/api/auth/me").status_code == 401

    bad = client.post("/api/auth/login", json={"username": "somchai", "password": "nope"})
    assert bad.status_code == 401 and "ไม่ถูกต้อง" in bad.json()["error"]["message"]

    ok = client.post("/api/auth/login", json={"username": "somchai", "password": "s3cret!"})
    assert ok.status_code == 200 and ok.json() == {"username": "somchai", "authDisabled": False}
    cookie = ok.headers["set-cookie"]
    assert "phaengan_session=" in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie
    assert "Secure" not in cookie  # cookieSecure=false locally

    assert client.get("/api/auth/me").json()["username"] == "somchai"
    assert client.get("/api/projects").status_code == 200
    created = client.post("/api/projects", json={"name": "x", "startDate": "2026-09-14"})
    assert created.status_code == 201

    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/projects").status_code == 401


def test_login_throttled_after_repeated_failures(client: TestClient, auth_env: dict):
    service.throttle.reset("testclient")
    for _ in range(5):
        assert (
            client.post(
                "/api/auth/login", json={"username": "somchai", "password": "x"}
            ).status_code
            == 401
        )
    res = client.post("/api/auth/login", json={"username": "somchai", "password": "s3cret!"})
    assert res.status_code == 429 and res.json()["error"]["code"] == "too_many_attempts"
    service.throttle.reset("testclient")


def test_auth_disabled_mode_reports_itself(client: TestClient):
    me = client.get("/api/auth/me")
    assert me.status_code == 200 and me.json()["authDisabled"] is True
    assert client.get("/api/projects").status_code == 200


def test_config_file_and_env_precedence(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    cfg_file = tmp_path / "config.json"
    cfg_file.write_text(
        '{"username": "file-user", "password": "file-pass", "cookieSecure": true, '
        '"publicOrigin": "https://plan.example.com", "sessionHours": 2}',
        encoding="utf-8",
    )
    monkeypatch.setenv("CONFIG_FILE", str(cfg_file))
    monkeypatch.delenv("AUTH_USERNAME", raising=False)
    monkeypatch.setenv("AUTH_PASSWORD", "env-wins")
    monkeypatch.setenv("AUTH_DISABLED", "")
    reset_settings_cache()
    s = settings()
    assert s.auth_username == "file-user" and s.auth_password == "env-wins"
    assert s.cookie_secure is True and s.public_origin == "https://plan.example.com"
    assert s.session_hours == 2 and s.auth_disabled is False
    assert len(s.session_secret) >= 32  # generated when missing

    cfg_file.write_text("{not json", encoding="utf-8")
    reset_settings_cache()
    with pytest.raises(RuntimeError):
        settings()


def test_security_headers_and_secure_cookie_on_public_site(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, data_dir: Path
):
    monkeypatch.setenv("AUTH_DISABLED", "0")
    monkeypatch.setenv("AUTH_USERNAME", "u")
    monkeypatch.setenv("AUTH_PASSWORD", "p")
    monkeypatch.setenv("COOKIE_SECURE", "true")
    reset_settings_cache()
    from app.main import create_app

    with TestClient(create_app()) as c:
        res = c.get("/api/health")
        assert res.headers["x-content-type-options"] == "nosniff"
        assert res.headers["x-frame-options"] == "DENY"
        assert res.headers["cache-control"] == "no-store"
        assert "max-age=31536000" in res.headers["strict-transport-security"]
        login = c.post("/api/auth/login", json={"username": "u", "password": "p"})
        assert "Secure" in login.headers["set-cookie"]


def test_serves_built_frontend_with_spa_fallback(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, data_dir: Path
):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><div id=root>แผนงาน</div>", encoding="utf-8")
    (dist / "assets" / "app-abc.js").write_text("console.log(1)", encoding="utf-8")
    (dist / "favicon.svg").write_text("<svg/>", encoding="utf-8")
    monkeypatch.setenv("STATIC_DIR", str(dist))
    reset_settings_cache()
    from app.main import create_app

    with TestClient(create_app()) as c:
        assert "แผนงาน" in c.get("/").text
        assert "แผนงาน" in c.get("/p/prj_x/gantt").text  # deep link -> index.html
        assert c.get("/assets/app-abc.js").text == "console.log(1)"
        assert c.get("/favicon.svg").status_code == 200
        assert c.get("/api/does-not-exist").status_code == 404
        assert c.get("/api/health").status_code == 200
        # no directory traversal
        assert "console.log" not in c.get("/../pyproject.toml").text
