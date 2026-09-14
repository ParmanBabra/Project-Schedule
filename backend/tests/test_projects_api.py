import json
from pathlib import Path

from fastapi.testclient import TestClient

from tests.api_helpers import create_project, sample


def test_create_returns_project_with_schedule_and_writes_file(client: TestClient, data_dir: Path):
    body = create_project(client)
    assert body["id"].startswith("prj_")
    assert body["workingDays"] == [1, 2, 3, 4, 5]
    assert body["buffer"]["method"] == "ccpm"
    assert body["schedule"]["tasks"] == {} and body["schedule"]["summary"]["plannedEnd"] is None
    file = data_dir / "projects" / f"{body['id']}.json"
    assert file.exists()
    stored = json.loads(file.read_text(encoding="utf-8"))
    assert stored["name"] == "ระบบจองห้องประชุม" and "schedule" not in stored
    index = json.loads((data_dir / "index.json").read_text(encoding="utf-8"))
    assert [p["id"] for p in index["projects"]] == [body["id"]]


def test_create_rejects_bad_working_days(client: TestClient):
    res = client.post(
        "/api/projects", json={"name": "x", "startDate": "2026-09-14", "workingDays": []}
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_failed"


def test_list_includes_computed_summary(client: TestClient):
    pid, _ = sample(client)
    create_project(client, name="ว่างเปล่า")
    res = client.get("/api/projects")
    assert res.status_code == 200
    items = {p["id"]: p for p in res.json()}
    assert items[pid]["plannedEnd"] == "2026-10-06"
    assert items[pid]["committedEnd"] == "2026-10-19"
    assert items[pid]["criticalCount"] == 4 and items[pid]["taskCount"] == 6


def test_get_update_and_not_found(client: TestClient):
    pid = create_project(client)["id"]
    res = client.patch(f"/api/projects/{pid}", json={"name": "ชื่อใหม่", "holidays": ["2026-10-13"]})
    assert res.status_code == 200 and res.json()["name"] == "ชื่อใหม่"
    assert res.json()["holidays"] == ["2026-10-13"]
    assert client.get(f"/api/projects/{pid}").json()["name"] == "ชื่อใหม่"
    missing = client.get("/api/projects/prj_missing")
    assert missing.status_code == 404 and missing.json()["error"]["code"] == "not_found"


def test_delete_moves_file_to_trash(client: TestClient, data_dir: Path):
    pid = create_project(client)["id"]
    assert client.delete(f"/api/projects/{pid}").status_code == 204
    assert client.get(f"/api/projects/{pid}").status_code == 404
    assert not (data_dir / "projects" / f"{pid}.json").exists()
    assert len(list((data_dir / "trash").glob(f"{pid}-*.json"))) == 1
    assert client.get("/api/projects").json() == []


def test_duplicate_copies_tasks_with_new_id(client: TestClient):
    pid, _ = sample(client)
    res = client.post(f"/api/projects/{pid}/duplicate", json={"name": "สำเนา"})
    assert res.status_code == 201
    copy = res.json()
    assert copy["id"] != pid and copy["name"] == "สำเนา"
    assert len(copy["tasks"]) == 6 and len(copy["dependencies"]) == 6
    assert copy["schedule"]["summary"]["plannedEnd"] == "2026-10-06"


def test_update_buffer_and_rules_recompute_schedule(client: TestClient):
    pid, _ = sample(client)
    res = client.patch(
        f"/api/projects/{pid}/buffer", json={"method": "percent", "riskLevel": "high"}
    )
    assert res.status_code == 200
    assert res.json()["schedule"]["buffer"]["days"] == 5
    res = client.patch(f"/api/projects/{pid}/rules", json={"nearCriticalFloatDays": 2})
    assert res.json()["schedule"]["summary"]["nearCriticalCount"] == 2
    assert res.json()["rules"]["lagUnit"] == "working"  # untouched fields keep defaults


def test_backups_are_written_on_every_save(client: TestClient, data_dir: Path):
    pid = create_project(client)["id"]
    for i in range(3):
        client.patch(f"/api/projects/{pid}", json={"name": f"v{i}"})
    assert len(list((data_dir / "backups" / pid).glob("*.json"))) == 3


def test_put_replaces_state_for_undo(client: TestClient):
    pid, t = sample(client)
    before = client.get(f"/api/projects/{pid}").json()
    client.patch(f"/api/projects/{pid}/tasks/{t['พัฒนา Backend']}", json={"duration": 10})
    assert (
        client.get(f"/api/projects/{pid}").json()["schedule"]["summary"]["plannedEnd"]
        == "2026-10-12"
    )
    body = {
        k: before[k]
        for k in (
            "name",
            "startDate",
            "holidays",
            "workingDays",
            "tasks",
            "dependencies",
            "assignments",
            "buffer",
            "rules",
        )
    }
    res = client.put(f"/api/projects/{pid}", json=body)
    assert res.status_code == 200, res.text
    assert res.json()["schedule"]["summary"]["plannedEnd"] == "2026-10-06"
    # a cyclic snapshot is rejected and nothing changes
    body["dependencies"].append(
        {"id": "d_bad", "from": t["ทดสอบระบบ"], "to": t["รวบรวมความต้องการ"], "type": "FS", "lag": 0}
    )
    assert client.put(f"/api/projects/{pid}", json=body).status_code == 422
    assert (
        client.get(f"/api/projects/{pid}").json()["schedule"]["summary"]["plannedEnd"]
        == "2026-10-06"
    )
