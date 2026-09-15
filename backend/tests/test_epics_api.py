"""EPIC-1..5: create (manual / bulk paste / from existing), update, members, roll-up."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api_helpers import create_project, sample


def _by_name(project: dict) -> dict[str, dict]:
    return {t["name"]: t for t in project["tasks"]}


def _epic(project: dict, name: str) -> dict:
    return next(t for t in project["tasks"] if t["epic"] is not None and t["name"] == name)


def test_create_epic_with_new_tasks_rolls_up_and_links(client: TestClient):
    pid = create_project(client)["id"]
    res = client.post(
        f"/api/projects/{pid}/epics",
        json={
            "name": "Picking list",
            "description": "หยิบสินค้าตาม picking list",
            "tasks": [
                {"name": "Picking list", "duration": 3},
                {"name": "Plant Route (Mobile)", "duration": 5},
                {"name": "Confirm", "duration": 2, "checklist": ["ทดสอบกับคลัง", "อบรม"]},
            ],
        },
    )
    assert res.status_code == 201, res.text
    p = res.json()
    epic = _epic(p, "Picking list")
    assert epic["epic"]["color"] == "#6a4fd8" and epic["epic"]["description"].startswith("หยิบ")
    kids = sorted((x for x in p["tasks"] if x["parentId"] == epic["id"]), key=lambda x: x["order"])
    assert [k["name"] for k in kids] == ["Picking list", "Plant Route (Mobile)", "Confirm"]
    assert [c["text"] for c in kids[2]["checklist"]] == ["ทดสอบกับคลัง", "อบรม"]
    s = p["schedule"]["tasks"][epic["id"]]
    assert s["isSummary"] is True and s["duration"] == 10  # 3 + 5 + 2 chained FS
    assert s["wbs"] == "1" and p["schedule"]["tasks"][kids[1]["id"]]["wbs"] == "1.2"
    assert len(p["dependencies"]) == 2

    # second Epic gets the next colour and lands after the first
    res = client.post(
        f"/api/projects/{pid}/epics",
        json={"name": "Master", "tasks": [{"name": "A"}], "sequential": False},
    )
    p = res.json()
    m = _by_name(p)["Master"]
    assert m["epic"]["color"] == "#e0457b" and m["order"] == 2 and m["parentId"] is None


def test_empty_epic_is_a_summary_row(client: TestClient):
    pid = create_project(client)["id"]
    p = client.post(f"/api/projects/{pid}/epics", json={"name": "ว่าง"}).json()
    e = _by_name(p)["ว่าง"]
    s = p["schedule"]["tasks"][e["id"]]
    assert s["isSummary"] is True and s["isMilestone"] is False and s["duration"] == 0
    assert p["schedule"]["summary"]["taskCount"] == 0


def test_bulk_paste_creates_many_epics_merges_by_name_and_can_link(client: TestClient):
    pid = create_project(client)["id"]
    client.post(
        f"/api/projects/{pid}/epics",
        json={"name": "Picking list", "tasks": [{"name": "Picking list"}]},
    )
    body = {
        "linkEpics": True,
        "epics": [
            {
                "name": "picking LIST",
                "tasks": [{"name": "Confirm", "duration": 2}],
            },  # merges (case-insensitive)
            {
                "name": "Master for Standalone (Juno)",
                "tasks": [
                    {"name": "Integration Module", "duration": 4},
                    {"name": "Master Data", "duration": 3, "checklist": ["Create", "Edit"]},
                ],
            },
            {
                "name": "Interface Automated WH",
                "sequential": False,
                "tasks": [{"name": "Create Task"}, {"name": "Update Task"}],
            },
        ],
    }
    res = client.post(f"/api/projects/{pid}/epics/bulk", json=body)
    assert res.status_code == 201, res.text
    p = res.json()
    t = _by_name(p)
    epics = [x for x in p["tasks"] if x["epic"] is not None]
    assert sorted(x["name"] for x in epics) == [
        "Interface Automated WH",
        "Master for Standalone (Juno)",
        "Picking list",
    ]
    assert t["Confirm"]["parentId"] == _epic(p, "Picking list")["id"]
    assert len({x["epic"]["color"] for x in epics}) == 3
    # linkEpics: Master waits for Picking list, Interface waits for Master (group -> group FS)
    names = {x["id"]: x["name"] for x in p["tasks"]}
    links = {(names[d["from"]], names[d["to"]]) for d in p["dependencies"] if d["type"] == "FS"}
    assert ("Picking list", "Master for Standalone (Juno)") in links
    assert ("Master for Standalone (Juno)", "Interface Automated WH") in links
    sched = p["schedule"]["tasks"]
    assert sched[t["Integration Module"]["id"]]["start"] > sched[t["Confirm"]["id"]]["end"]
    # unlinked tasks inside "Interface" start together
    assert sched[t["Create Task"]["id"]]["start"] == sched[t["Update Task"]["id"]]["start"]


def test_epic_from_existing_tasks_members_update_and_convert(client: TestClient):
    pid, t = sample(client)
    res = client.post(
        f"/api/projects/{pid}/epics",
        json={
            "name": "ออกแบบทั้งหมด",
            "color": "#1f9e89",
            "existingTaskIds": [t["ออกแบบระบบ"], t["ออกแบบ UI"]],
            "position": "after",
            "afterTaskId": t["รวบรวมความต้องการ"],
        },
    )
    assert res.status_code == 201, res.text
    p = res.json()
    epic = _by_name(p)["ออกแบบทั้งหมด"]
    assert epic["order"] == 2 and epic["epic"]["color"] == "#1f9e89"
    for name in ["ออกแบบระบบ", "ออกแบบ UI"]:
        assert _by_name(p)[name]["parentId"] == epic["id"]
    # dependencies survived, schedule unchanged
    assert p["schedule"]["summary"]["plannedEnd"] == "2026-10-06"
    assert p["schedule"]["tasks"][epic["id"]]["isSummary"] is True

    # move another task in
    res = client.post(
        f"/api/projects/{pid}/epics/{epic['id']}/members", json={"taskIds": [t["พัฒนา Frontend"]]}
    )
    assert (
        res.status_code == 200 and _by_name(res.json())["พัฒนา Frontend"]["parentId"] == epic["id"]
    )

    # update info
    rid = client.post("/api/resources", json={"name": "สุดา"}).json()["id"]
    res = client.patch(
        f"/api/projects/{pid}/epics/{epic['id']}",
        json={"name": "Design", "description": "UX + system", "ownerResourceId": rid},
    )
    e = _by_name(res.json())["Design"]
    assert e["epic"]["ownerResourceId"] == rid and e["epic"]["description"] == "UX + system"
    res = client.patch(f"/api/projects/{pid}/epics/{epic['id']}", json={"clearOwner": True})
    assert _by_name(res.json())["Design"]["epic"]["ownerResourceId"] is None

    # convert a plain task into an Epic; non-Epic rejected by epic endpoints
    plain = t["ทดสอบระบบ"]
    assert client.patch(f"/api/projects/{pid}/epics/{plain}", json={"name": "x"}).status_code == 422
    res = client.post(f"/api/projects/{pid}/epics/{plain}/convert")
    assert (
        res.status_code == 200 and _by_name(res.json())["ทดสอบระบบ"]["epic"]["color"] == "#6a4fd8"
    )

    # cannot move an Epic into itself / its ancestor
    assert (
        client.post(
            f"/api/projects/{pid}/epics/{epic['id']}/members", json={"taskIds": [epic["id"]]}
        ).status_code
        == 422
    )

    # task update can drop the Epic flag
    res = client.patch(f"/api/projects/{pid}/tasks/{plain}", json={"clearEpic": True})
    assert _by_name(res.json())["ทดสอบระบบ"]["epic"] is None
