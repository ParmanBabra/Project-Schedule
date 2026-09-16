from fastapi.testclient import TestClient

from tests.api_helpers import add_dep, add_task, create_project, sample


def wbs(body: dict) -> dict[str, str]:
    names = {t["id"]: t["name"] for t in body["tasks"]}
    return {names[tid]: s["wbs"] for tid, s in body["schedule"]["tasks"].items()}


def test_add_task_appends_in_order_and_returns_schedule(client: TestClient):
    pid = create_project(client)["id"]
    a, body = add_task(client, pid, "A", 3)
    assert body["schedule"]["tasks"][a]["end"] == "2026-09-16"
    b, body = add_task(client, pid, "B", 2)
    assert [t["order"] for t in body["tasks"]] == [1, 2]
    _, body = add_task(client, pid, "A2", 1, afterId=a)
    assert wbs(body) == {"A": "1", "A2": "2", "B": "3"}


def test_milestone_forces_zero_duration(client: TestClient):
    pid = create_project(client)["id"]
    m, body = add_task(client, pid, "ส่งมอบ", 5, isMilestone=True)
    assert (
        body["schedule"]["tasks"][m]["isMilestone"]
        and body["schedule"]["tasks"][m]["duration"] == 0
    )


def test_update_task_fields_and_clear_constraint(client: TestClient):
    pid = create_project(client)["id"]
    a, _ = add_task(client, pid, "A", 3)
    res = client.patch(
        f"/api/projects/{pid}/tasks/{a}",
        json={"duration": 4, "progress": 50, "constraint": {"type": "SNET", "date": "2026-09-21"}},
    )
    assert res.status_code == 200
    s = res.json()["schedule"]["tasks"][a]
    assert s["start"] == "2026-09-21" and s["end"] == "2026-09-24" and s["progress"] == 50
    res = client.patch(f"/api/projects/{pid}/tasks/{a}", json={"clearConstraint": True})
    assert res.json()["schedule"]["tasks"][a]["start"] == "2026-09-14"


def test_group_move_reorder_and_delete_modes(client: TestClient):
    pid, t = sample(client)
    # group ออกแบบระบบ + ออกแบบ UI under "ออกแบบ"
    res = client.post(
        f"/api/projects/{pid}/tasks/group",
        json={"name": "ออกแบบ", "taskIds": [t["ออกแบบระบบ"], t["ออกแบบ UI"]]},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    numbering = wbs(body)
    assert (
        numbering["ออกแบบ"] == "2"
        and numbering["ออกแบบระบบ"] == "2.1"
        and numbering["ออกแบบ UI"] == "2.2"
    )
    assert numbering["พัฒนา Backend"] == "3"
    gid = next(x["id"] for x in body["tasks"] if x["name"] == "ออกแบบ")
    assert (
        body["schedule"]["tasks"][gid]["isSummary"]
        and body["schedule"]["tasks"][gid]["end"] == "2026-09-23"
    )

    # move Backend into the group at position 1
    res = client.patch(
        f"/api/projects/{pid}/tasks/{t['พัฒนา Backend']}/move", json={"parentId": gid, "order": 1}
    )
    assert res.status_code == 200, res.text
    numbering = wbs(res.json())
    assert numbering["พัฒนา Backend"] == "2.1" and numbering["ออกแบบระบบ"] == "2.2"

    # cannot move the group under its own child
    bad = client.patch(f"/api/projects/{pid}/tasks/{gid}/move", json={"parentId": t["ออกแบบ UI"]})
    assert bad.status_code == 422

    # reorder root level: put ทดสอบ first
    root_ids = [
        x["id"]
        for x in sorted(res.json()["tasks"], key=lambda x: x["order"])
        if x["parentId"] is None
    ]
    root_ids.remove(t["ทดสอบระบบ"])
    root_ids.insert(0, t["ทดสอบระบบ"])
    res = client.patch(
        f"/api/projects/{pid}/tasks/reorder", json={"parentId": None, "ids": root_ids}
    )
    assert res.status_code == 200 and wbs(res.json())["ทดสอบระบบ"] == "1"
    bad = client.patch(
        f"/api/projects/{pid}/tasks/reorder", json={"parentId": None, "ids": root_ids[:-1]}
    )
    assert bad.status_code == 422

    # delete the group with lift: children return to root and dependencies survive
    res = client.delete(f"/api/projects/{pid}/tasks/{gid}?mode=lift")
    assert res.status_code == 200
    body = res.json()
    assert all(x["parentId"] is None for x in body["tasks"]) and len(body["tasks"]) == 6
    assert len(body["dependencies"]) == 6

    # delete with cascade removes children and their dependencies
    res = client.post(
        f"/api/projects/{pid}/tasks/group",
        json={"name": "G", "taskIds": [t["ออกแบบระบบ"], t["ออกแบบ UI"]]},
    )
    gid = next(x["id"] for x in res.json()["tasks"] if x["name"] == "G")
    res = client.delete(f"/api/projects/{pid}/tasks/{gid}?mode=cascade")
    body = res.json()
    assert len(body["tasks"]) == 4
    remaining = {x["id"] for x in body["tasks"]}
    assert all(d["from"] in remaining and d["to"] in remaining for d in body["dependencies"])


def test_group_requires_same_parent(client: TestClient):
    pid = create_project(client)["id"]
    a, _ = add_task(client, pid, "A")
    b, _ = add_task(client, pid, "B", parentId=a)
    res = client.post(f"/api/projects/{pid}/tasks/group", json={"name": "G", "taskIds": [a, b]})
    assert res.status_code == 422


def test_unknown_task_returns_404(client: TestClient):
    pid = create_project(client)["id"]
    assert client.patch(f"/api/projects/{pid}/tasks/t_nope", json={"name": "x"}).status_code == 404
    assert client.delete(f"/api/projects/{pid}/tasks/t_nope").status_code == 404


def test_dependency_kept_when_task_becomes_summary(client: TestClient):
    pid = create_project(client)["id"]
    a, _ = add_task(client, pid, "A", 2)
    b, _ = add_task(client, pid, "B", 2)
    add_dep(client, pid, a, b)
    c, body = add_task(client, pid, "C", 3, parentId=a)  # A becomes a summary of C
    s = body["schedule"]["tasks"]
    assert s[a]["isSummary"] and s[a]["end"] == "2026-09-16"
    assert s[b]["start"] == "2026-09-17"


def test_task_description_create_update_clear_and_export(client: TestClient):
    pid = create_project(client)["id"]
    res = client.post(
        f"/api/projects/{pid}/tasks",
        json={"name": "A", "duration": 2, "description": "  ทำร่วมกับทีมคลัง  "},
    )
    assert res.status_code == 201, res.text
    task = res.json()["tasks"][0]
    assert task["description"] == "ทำร่วมกับทีมคลัง"
    tid = task["id"]

    # default is empty; other patches leave it alone
    b, _ = add_task(client, pid, "B", 1)
    assert client.get(f"/api/projects/{pid}").json()["tasks"][1]["description"] == ""
    res = client.patch(f"/api/projects/{pid}/tasks/{tid}", json={"duration": 3})
    assert res.json()["tasks"][0]["description"] == "ทำร่วมกับทีมคลัง"

    res = client.patch(f"/api/projects/{pid}/tasks/{tid}", json={"description": "รอเอกสาร\nจากบัญชี"})
    assert res.status_code == 200
    assert res.json()["tasks"][0]["description"] == "รอเอกสาร\nจากบัญชี"
    # persisted on disk and read back
    saved = client.get(f"/api/projects/{pid}").json()["tasks"][0]["description"]
    assert saved == "รอเอกสาร\nจากบัญชี"

    # too long is rejected
    res = client.patch(f"/api/projects/{pid}/tasks/{tid}", json={"description": "x" * 2001})
    assert res.status_code == 422

    # empty string clears
    res = client.patch(f"/api/projects/{pid}/tasks/{tid}", json={"description": ""})
    assert res.json()["tasks"][0]["description"] == ""

    # CSV export carries the note in the last column
    client.patch(f"/api/projects/{pid}/tasks/{b}", json={"description": "หมายเหตุ B"})
    csv_text = client.get(f"/api/projects/{pid}/export.csv").text
    header = csv_text.splitlines()[0]
    assert header.endswith("งานก่อนหน้า,หมายเหตุ")
    assert any(line.endswith(",หมายเหตุ B") for line in csv_text.splitlines())
