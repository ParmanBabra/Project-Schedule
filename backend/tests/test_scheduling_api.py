from fastapi.testclient import TestClient

from tests.api_helpers import sample


def test_get_schedule_matches_project_schedule(client: TestClient):
    pid, t = sample(client)
    res = client.get(f"/api/projects/{pid}/schedule")
    assert res.status_code == 200
    s = res.json()
    assert s["summary"]["plannedEnd"] == "2026-10-06" and s["buffer"]["end"] == "2026-10-19"
    assert s["criticalPath"] == [
        t["รวบรวมความต้องการ"],
        t["ออกแบบระบบ"],
        t["พัฒนา Backend"],
        t["ทดสอบระบบ"],
    ]
    assert s["tasks"][t["ออกแบบ UI"]]["totalFloat"] == 2


def test_preview_does_not_persist(client: TestClient):
    pid, t = sample(client)
    stored = client.get(f"/api/projects/{pid}").json()
    task = next(x for x in stored["tasks"] if x["id"] == t["พัฒนา Backend"])
    task["duration"] = 10
    res = client.post(f"/api/projects/{pid}/schedule/preview", json={"patchTasks": [task]})
    assert res.status_code == 200
    assert res.json()["summary"]["plannedEnd"] == "2026-10-12"
    assert (
        client.get(f"/api/projects/{pid}").json()["schedule"]["summary"]["plannedEnd"]
        == "2026-10-06"
    )


def test_preview_with_full_replacement_and_rules(client: TestClient):
    pid, t = sample(client)
    res = client.post(
        f"/api/projects/{pid}/schedule/preview",
        json={"rules": {"nearCriticalFloatDays": 2}, "holidays": ["2026-09-15"]},
    )
    body = res.json()
    assert body["summary"]["nearCriticalCount"] == 2
    assert body["summary"]["plannedEnd"] == "2026-10-07"


def test_preview_reports_cycle(client: TestClient):
    pid, t = sample(client)
    deps = client.get(f"/api/projects/{pid}").json()["dependencies"]
    deps.append(
        {"id": "d_bad", "from": t["ทดสอบระบบ"], "to": t["รวบรวมความต้องการ"], "type": "FS", "lag": 0}
    )
    res = client.post(f"/api/projects/{pid}/schedule/preview", json={"dependencies": deps})
    assert res.status_code == 422 and res.json()["error"]["code"] == "cycle_detected"
