"""IO-1..IO-3: export JSON / CSV and import with resource matching by name."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api_helpers import sample


def _assign(client: TestClient, pid: str, tid: str, rid: str, units: int = 100) -> None:
    res = client.post(
        f"/api/projects/{pid}/assignments", json={"taskId": tid, "resourceId": rid, "units": units}
    )
    assert res.status_code == 201, res.text


def _seed(client: TestClient) -> tuple[str, dict[str, str], dict[str, str]]:
    pid, t = sample(client)
    rids = {}
    for name in ["สมชาย", "สุดา"]:
        rids[name] = client.post("/api/resources", json={"name": name}).json()["id"]
    _assign(client, pid, t["ออกแบบระบบ"], rids["สุดา"])
    _assign(client, pid, t["พัฒนา Backend"], rids["สมชาย"], 50)
    return pid, t, rids


def test_export_contains_state_and_used_resources_only(client: TestClient):
    pid, _, rids = _seed(client)
    client.post("/api/resources", json={"name": "คนนอก"})  # not assigned -> not exported
    res = client.get(f"/api/projects/{pid}/export")
    assert res.status_code == 200
    assert "attachment" in res.headers["content-disposition"]
    doc = res.json()
    assert doc["format"] == "phaengan-project" and doc["version"] == 1
    assert doc["project"]["name"] == "ระบบจองห้องประชุม"
    assert len(doc["project"]["tasks"]) == 6 and len(doc["project"]["dependencies"]) == 6
    assert {r["name"] for r in doc["resources"]} == {"สมชาย", "สุดา"}
    assert set(rids.values()) == {r["id"] for r in doc["resources"]}
    assert "schedule" not in doc["project"] and "id" not in doc["project"]


def test_import_matches_resources_by_name_and_creates_missing(client: TestClient):
    pid, t, rids = _seed(client)
    doc = client.get(f"/api/projects/{pid}/export").json()
    # simulate another data folder: rename สุดา -> "สุดา  " (whitespace/case-insensitive match)
    for r in doc["resources"]:
        if r["name"] == "สุดา":
            r["name"] = " สุดา "
        if r["name"] == "สมชาย":
            r["name"] = "สมชาย ใจดี"  # no match -> created
    doc["name"] = "นำเข้าแล้ว"
    res = client.post("/api/projects/import", json=doc)
    assert res.status_code == 201, res.text
    body = res.json()
    new = body["project"]
    assert new["id"] != pid and new["name"] == "นำเข้าแล้ว"
    assert body["result"]["matchedResources"] == ["สุดา"]
    assert body["result"]["createdResources"] == ["สมชาย ใจดี"]
    # schedule recomputed identically
    old = client.get(f"/api/projects/{pid}").json()
    assert new["schedule"]["summary"]["plannedEnd"] == old["schedule"]["summary"]["plannedEnd"]
    assert len(new["schedule"]["criticalPath"]) == len(old["schedule"]["criticalPath"])
    # assignments remapped to this folder's resources
    by_task = {a["taskId"]: a["resourceId"] for a in new["assignments"]}
    assert by_task[t["ออกแบบระบบ"]] == rids["สุดา"]
    created = next(r for r in client.get("/api/resources").json() if r["name"] == "สมชาย ใจดี")
    assert by_task[t["พัฒนา Backend"]] == created["id"]
    assert len(client.get("/api/projects").json()) == 2


def test_import_rejects_foreign_or_broken_files(client: TestClient):
    pid, _, _ = _seed(client)
    doc = client.get(f"/api/projects/{pid}/export").json()
    bad = dict(doc, format="ms-project")
    res = client.post("/api/projects/import", json=bad)
    assert res.status_code == 422 and res.json()["error"]["code"] == "validation_failed"
    broken = dict(doc)
    broken["project"] = dict(
        doc["project"],
        dependencies=doc["project"]["dependencies"]
        + [
            {
                "id": "d_x",
                "from": "t_missing",
                "to": doc["project"]["tasks"][0]["id"],
                "type": "FS",
                "lag": 0,
            }
        ],
    )
    assert client.post("/api/projects/import", json=broken).status_code == 422
    # cycles are caught by the engine too
    tasks = doc["project"]["tasks"]
    cyc = dict(doc)
    cyc["project"] = dict(
        doc["project"],
        dependencies=[
            {"id": "d_1", "from": tasks[0]["id"], "to": tasks[1]["id"], "type": "FS", "lag": 0},
            {"id": "d_2", "from": tasks[1]["id"], "to": tasks[0]["id"], "type": "FS", "lag": 0},
        ],
    )
    res = client.post("/api/projects/import", json=cyc)
    assert res.status_code == 422 and res.json()["error"]["code"] == "cycle_detected"
    assert len(client.get("/api/projects").json()) == 1


def test_export_csv_has_computed_columns(client: TestClient):
    pid, _, _ = _seed(client)
    res = client.get(f"/api/projects/{pid}/export.csv")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    text = res.content.decode("utf-8")
    assert text.startswith("﻿")
    lines = text.lstrip("﻿").splitlines()
    assert lines[0].startswith("WBS,ชื่องาน,ประเภท,ระยะเวลา (วัน),เริ่ม,สิ้นสุด")
    first = lines[1].split(",")
    assert first[0] == "1" and first[1] == "รวบรวมความต้องการ" and first[4] == "2026-09-14"
    assert first[10] == "ใช่"  # critical
    row = next(line for line in lines if line.startswith("2,ออกแบบระบบ"))
    assert "สุดา 100%" in row and "รวบรวมความต้องการ (FS)" in row
    assert lines[-1].startswith("สำรองเวลาโครงการ,ccpm,")
