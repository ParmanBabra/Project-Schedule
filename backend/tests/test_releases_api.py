from fastapi.testclient import TestClient

from tests.api_helpers import add_dep, add_task, create_project


def build(client: TestClient) -> tuple[str, dict[str, str]]:
    pid = create_project(client)["id"]
    ids: dict[str, str] = {}
    ids["a"], _ = add_task(client, pid, "a", 3)
    ids["b"], _ = add_task(client, pid, "b", 5)
    ids["m1"], _ = add_task(client, pid, "m1", 0, isMilestone=True)
    ids["c"], _ = add_task(client, pid, "c", 4)
    ids["m2"], _ = add_task(client, pid, "m2", 0, isMilestone=True)
    for a, b in [("a", "b"), ("b", "m1"), ("b", "c"), ("c", "m2")]:
        add_dep(client, pid, ids[a], ids[b])
    return pid, ids


def test_create_update_delete_release_and_schedule_output(client: TestClient):
    pid, ids = build(client)
    res = client.post(
        f"/api/projects/{pid}/releases", json={"name": " ปีนี้ ", "milestoneTaskId": ids["m1"]}
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["releases"] == [
        {"id": "rel_01", "name": "ปีนี้", "milestoneTaskId": ids["m1"], "days": None}
    ]
    rel = body["schedule"]["releases"]
    # the buffer sticks to the milestone: only a, b and m1 feed it
    assert [r["id"] for r in rel] == ["rel_01", "tail"]
    assert set(rel[0]["taskIds"]) == {ids["a"], ids["b"], ids["m1"]}
    assert rel[0]["chainDays"] == 8 and rel[0]["days"] == 4
    assert rel[0]["chainTaskIds"] == [ids["a"], ids["b"]]
    assert rel[0]["plannedEnd"] == "2026-09-23" and rel[0]["end"] == "2026-09-29"
    # c and m2 feed no delivery point yet -> trailing buffer of their own
    assert set(rel[1]["taskIds"]) == {ids["c"], ids["m2"]} and rel[1]["milestoneTaskId"] == ""
    assert rel[1]["chainDays"] == 4 and rel[1]["days"] == 2 and rel[1]["plannedEnd"] == "2026-09-29"

    res = client.post(
        f"/api/projects/{pid}/releases",
        json={"name": "ปีหน้า", "milestoneTaskId": ids["m2"], "days": 3},
    )
    assert res.status_code == 201
    rel = res.json()["schedule"]["releases"]
    assert [r["name"] for r in rel] == ["ปีนี้", "ปีหน้า"]
    assert rel[1]["days"] == 3 and rel[1]["note"] == "กำหนดจำนวนวันเอง"
    assert set(rel[0]["taskIds"]) == {ids["a"], ids["b"], ids["m1"]}
    assert rel[0]["chainDays"] == 8 and rel[0]["days"] == 4 and rel[0]["plannedEnd"] == "2026-09-23"
    assert set(rel[1]["taskIds"]) == {ids["c"], ids["m2"]}

    res = client.patch(
        f"/api/projects/{pid}/releases/rel_02", json={"name": "R2", "clearDays": True}
    )
    assert res.status_code == 200
    r2 = res.json()["schedule"]["releases"][1]
    assert r2["name"] == "R2" and r2["days"] == 2  # ceil(4 * 50%)

    res = client.delete(f"/api/projects/{pid}/releases/rel_01")
    assert res.status_code == 200
    assert [r["id"] for r in res.json()["releases"]] == ["rel_02"]
    assert client.delete(f"/api/projects/{pid}/releases/rel_01").status_code == 404


def test_release_validation(client: TestClient):
    pid, ids = build(client)
    url = f"/api/projects/{pid}/releases"
    res = client.post(url, json={"name": "x", "milestoneTaskId": "nope"})
    assert res.status_code == 404
    client.post(url, json={"name": "x", "milestoneTaskId": ids["m1"]})
    res = client.post(url, json={"name": "y", "milestoneTaskId": ids["m1"]})
    assert res.status_code == 422 and "จุดส่งมอบ" in res.text
    # a group cannot be a delivery point
    res = client.post(
        f"/api/projects/{pid}/tasks/group", json={"name": "G", "taskIds": [ids["a"], ids["b"]]}
    )
    gid = next(t["id"] for t in res.json()["tasks"] if t["name"] == "G")
    res = client.post(url, json={"name": "z", "milestoneTaskId": gid})
    assert res.status_code == 422
    res = client.post(url, json={"name": "", "milestoneTaskId": ids["m2"]})
    assert res.status_code == 422


def test_deleting_the_milestone_removes_its_release_and_baseline_entry(client: TestClient):
    pid, ids = build(client)
    url = f"/api/projects/{pid}/releases"
    client.post(url, json={"name": "ปีนี้", "milestoneTaskId": ids["m1"]})
    client.post(url, json={"name": "ปีหน้า", "milestoneTaskId": ids["m2"]})
    res = client.post(f"/api/projects/{pid}/baseline")
    assert res.status_code == 201
    base = res.json()["baseline"]
    assert base["releases"] == {
        "rel_01": {"plannedEnd": "2026-09-23", "bufferDays": 4},
        "rel_02": {"plannedEnd": "2026-09-29", "bufferDays": 2},
    }
    res = client.delete(f"/api/projects/{pid}/tasks/{ids['m1']}")
    assert res.status_code == 200
    body = res.json()
    assert [r["id"] for r in body["releases"]] == ["rel_02"]
    assert list(body["baseline"]["releases"]) == ["rel_02"]
    assert [r["id"] for r in body["schedule"]["releases"]] == ["rel_02"]


def test_releases_survive_undo_replace_and_export_import(client: TestClient):
    pid, ids = build(client)
    body = client.post(
        f"/api/projects/{pid}/releases", json={"name": "ปีนี้", "milestoneTaskId": ids["m1"]}
    ).json()
    state = {
        k: body[k]
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
            "releases",
        )
    }
    res = client.put(f"/api/projects/{pid}", json=state)
    assert res.status_code == 200 and res.json()["releases"] == body["releases"]
    # undo to a state without the release removes it
    res = client.put(f"/api/projects/{pid}", json={**state, "releases": []})
    assert res.json()["releases"] == [] and res.json()["schedule"]["releases"] == []
    # export / import keeps releases
    client.put(f"/api/projects/{pid}", json=state)
    exported = client.get(f"/api/projects/{pid}/export").json()
    assert exported["project"]["releases"] == body["releases"]
    res = client.post("/api/projects/import", json={**exported, "name": "copy"})
    assert res.status_code == 201, res.text
    assert res.json()["project"]["releases"] == body["releases"]
