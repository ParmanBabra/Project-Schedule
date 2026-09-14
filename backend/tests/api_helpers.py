from __future__ import annotations

from fastapi.testclient import TestClient


def create_project(
    client: TestClient, name: str = "ระบบจองห้องประชุม", start: str = "2026-09-14"
) -> dict:
    res = client.post("/api/projects", json={"name": name, "startDate": start})
    assert res.status_code == 201, res.text
    return res.json()


def add_task(
    client: TestClient, pid: str, name: str, duration: int = 1, **extra
) -> tuple[str, dict]:
    res = client.post(
        f"/api/projects/{pid}/tasks", json={"name": name, "duration": duration, **extra}
    )
    assert res.status_code == 201, res.text
    body = res.json()
    tid = next(t["id"] for t in body["tasks"] if t["name"] == name)
    return tid, body


def add_dep(client: TestClient, pid: str, a: str, b: str, **extra) -> dict:
    res = client.post(f"/api/projects/{pid}/dependencies", json={"from": a, "to": b, **extra})
    assert res.status_code == 201, res.text
    return res.json()


def sample(client: TestClient) -> tuple[str, dict[str, str]]:
    """Build the documented sample project via the API. Returns (project id, name -> task id)."""
    pid = create_project(client)["id"]
    ids: dict[str, str] = {}
    for name, dur in [
        ("รวบรวมความต้องการ", 3),
        ("ออกแบบระบบ", 5),
        ("ออกแบบ UI", 4),
        ("พัฒนา Backend", 6),
        ("พัฒนา Frontend", 5),
        ("ทดสอบระบบ", 3),
    ]:
        ids[name], _ = add_task(client, pid, name, dur)
    t = ids
    for a, b in [
        ("รวบรวมความต้องการ", "ออกแบบระบบ"),
        ("รวบรวมความต้องการ", "ออกแบบ UI"),
        ("ออกแบบระบบ", "พัฒนา Backend"),
        ("ออกแบบ UI", "พัฒนา Frontend"),
        ("พัฒนา Backend", "ทดสอบระบบ"),
        ("พัฒนา Frontend", "ทดสอบระบบ"),
    ]:
        add_dep(client, pid, t[a], t[b])
    return pid, ids
