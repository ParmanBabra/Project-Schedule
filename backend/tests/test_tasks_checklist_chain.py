"""TSK-8 checklist-driven progress and TSK-9 task chains."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api_helpers import add_task, create_project, sample


def _patch(client: TestClient, pid: str, tid: str, **body) -> dict:
    res = client.patch(f"/api/projects/{pid}/tasks/{tid}", json=body)
    assert res.status_code == 200, res.text
    return res.json()


def _task(project: dict, tid: str) -> dict:
    return next(t for t in project["tasks"] if t["id"] == tid)


# ------------------------------------------------------------------ checklist


def test_checklist_drives_progress_and_assigns_ids(client: TestClient):
    pid = create_project(client)["id"]
    tid, _ = add_task(client, pid, "ทำ putaway", 5, progress=10)
    p = _patch(
        client,
        pid,
        tid,
        checklist=[
            {"text": "เขียน spec", "done": True},
            {"text": "ทำหน้าจอ", "done": False},
            {"text": "ทดสอบ", "done": False},
        ],
    )
    t = _task(p, tid)
    assert [c["done"] for c in t["checklist"]] == [True, False, False]
    assert all(c["id"].startswith("c_") for c in t["checklist"])
    assert len({c["id"] for c in t["checklist"]}) == 3
    assert t["progress"] == 33 and t["progressFromChecklist"] is True
    assert p["schedule"]["tasks"][tid]["progress"] == 33

    # tick one more, keep ids; order follows the list
    items = t["checklist"]
    items[1]["done"] = True
    p = _patch(client, pid, tid, checklist=[items[1], items[0], items[2]])
    t = _task(p, tid)
    assert [c["id"] for c in t["checklist"]] == [items[1]["id"], items[0]["id"], items[2]["id"]]
    assert t["progress"] == 67

    # manual progress is ignored while the switch is on ...
    assert _task(_patch(client, pid, tid, progress=90), tid)["progress"] == 67
    # ... and respected once it is off
    p = _patch(client, pid, tid, progressFromChecklist=False, progress=90)
    assert _task(p, tid)["progress"] == 90
    # removing every item keeps the last value
    p = _patch(client, pid, tid, progressFromChecklist=True, checklist=[])
    assert _task(p, tid)["progress"] == 90 and _task(p, tid)["checklist"] == []


def test_checklist_survives_state_replace_and_export(client: TestClient):
    pid = create_project(client)["id"]
    tid, _ = add_task(client, pid, "งาน", 2)
    _patch(client, pid, tid, checklist=[{"text": "a", "done": True}, {"text": "b"}])
    project = client.get(f"/api/projects/{pid}").json()
    state = {
        k: project[k]
        for k in [
            "name",
            "startDate",
            "holidays",
            "workingDays",
            "tasks",
            "dependencies",
            "assignments",
            "buffer",
            "rules",
        ]
    }
    state["tasks"][0]["checklist"][1]["done"] = True
    res = client.put(f"/api/projects/{pid}", json=state)
    assert res.status_code == 200 and _task(res.json(), tid)["progress"] == 100
    doc = client.get(f"/api/projects/{pid}/export").json()
    assert doc["project"]["tasks"][0]["checklist"][0]["text"] == "a"


# ------------------------------------------------------------------ chain


STEPS = [
    {"name": "ออกแบบ UI", "duration": 3},
    {"name": "พัฒนา Frontend", "duration": 5},
    {"name": "พัฒนา Backend", "duration": 5, "parallel": True},
    {"name": "ทดสอบ", "duration": 3},
    {"name": "UAT", "duration": 2, "enabled": False},
    {"name": "Deploy", "duration": 1},
]


def _chain(client: TestClient, pid: str, tid: str, dry_run: bool = False, **body) -> dict:
    res = client.post(
        f"/api/projects/{pid}/tasks/{tid}/chain?dryRun={'true' if dry_run else 'false'}",
        json={"steps": STEPS, **body},
    )
    assert res.status_code == 201, res.text
    return res.json()


def _deps_of(project: dict, tid: str) -> set[tuple[str, str]]:
    names = {t["id"]: t["name"] for t in project["tasks"]}
    return {(names[d["from"]], d["type"]) for d in project["dependencies"] if d["to"] == tid}


def test_chain_creates_linked_tasks_with_parallel_block(client: TestClient):
    pid, t = sample(client)
    src = t["ออกแบบระบบ"]
    p = _chain(client, pid, src)
    names = {x["name"]: x for x in p["tasks"]}
    created = [n for n in names if n.startswith("ออกแบบระบบ – ")]
    assert created == [
        "ออกแบบระบบ – ออกแบบ UI",
        "ออกแบบระบบ – พัฒนา Frontend",
        "ออกแบบระบบ – พัฒนา Backend",
        "ออกแบบระบบ – ทดสอบ",
        "ออกแบบระบบ – Deploy",
    ]
    # order: right after the source, before the old successors
    order = [
        x["name"] for x in sorted(p["tasks"], key=lambda x: x["order"]) if x["parentId"] is None
    ]
    assert order.index("ออกแบบระบบ – Deploy") == order.index("ออกแบบระบบ") + 5
    assert order.index("พัฒนา Backend") > order.index("ออกแบบระบบ – Deploy")
    # links
    assert _deps_of(p, names["ออกแบบระบบ – ออกแบบ UI"]["id"]) == {("ออกแบบระบบ", "FS")}
    assert _deps_of(p, names["ออกแบบระบบ – พัฒนา Frontend"]["id"]) == {
        ("ออกแบบระบบ – ออกแบบ UI", "FS")
    }
    assert _deps_of(p, names["ออกแบบระบบ – พัฒนา Backend"]["id"]) == {
        ("ออกแบบระบบ – ออกแบบ UI", "FS")
    }
    assert _deps_of(p, names["ออกแบบระบบ – ทดสอบ"]["id"]) == {
        ("ออกแบบระบบ – พัฒนา Frontend", "FS"),
        ("ออกแบบระบบ – พัฒนา Backend", "FS"),
    }
    assert _deps_of(p, names["ออกแบบระบบ – Deploy"]["id"]) == {("ออกแบบระบบ – ทดสอบ", "FS")}
    # FE and BE start on the same day; the schedule stays valid
    sch = p["schedule"]["tasks"]
    assert (
        sch[names["ออกแบบระบบ – พัฒนา Frontend"]["id"]]["start"]
        == sch[names["ออกแบบระบบ – พัฒนา Backend"]["id"]]["start"]
    )
    # the original successor (พัฒนา Backend) is untouched
    assert _deps_of(p, t["พัฒนา Backend"]) == {("ออกแบบระบบ", "FS")}
    # template remembered
    assert [s["name"] for s in p["chainTemplates"]] == [s["name"] for s in STEPS]
    assert p["chainTemplates"][4]["enabled"] is False


def test_chain_group_copy_assignees_and_dry_run(client: TestClient):
    pid, t = sample(client)
    src = t["ออกแบบระบบ"]
    rid = client.post("/api/resources", json={"name": "สุดา"}).json()["id"]
    client.post(
        f"/api/projects/{pid}/assignments", json={"taskId": src, "resourceId": rid, "units": 50}
    )

    before = client.get(f"/api/projects/{pid}").json()
    preview = _chain(
        client,
        pid,
        src,
        dry_run=True,
        groupName="ออกแบบระบบ",
        copyAssignees=True,
        prefixWithSource=False,
    )
    assert len(preview["tasks"]) == len(before["tasks"]) + 6  # 5 steps + group
    assert (
        preview["schedule"]["summary"]["plannedEnd"] > before["schedule"]["summary"]["plannedEnd"]
    )
    # nothing persisted by the dry run
    after = client.get(f"/api/projects/{pid}").json()
    assert len(after["tasks"]) == len(before["tasks"]) and after["chainTemplates"] is None

    p = _chain(client, pid, src, groupName="ออกแบบระบบ", copyAssignees=True, prefixWithSource=False)
    group_task = next(x for x in p["tasks"] if x["name"] == "ออกแบบระบบ" and x["id"] != src)
    kids = sorted(
        (x for x in p["tasks"] if x["parentId"] == group_task["id"]), key=lambda x: x["order"]
    )
    assert [k["name"] for k in kids] == [
        "ออกแบบระบบ",
        "ออกแบบ UI",
        "พัฒนา Frontend",
        "พัฒนา Backend",
        "ทดสอบ",
        "Deploy",
    ]
    assert group_task["order"] == 2  # took the source's slot at top level
    assert p["schedule"]["tasks"][group_task["id"]]["isSummary"] is True
    copied = [a for a in p["assignments"] if a["resourceId"] == rid]
    assert len(copied) == 6 and all(a["units"] == 50 for a in copied)


def test_chain_rejects_groups_and_empty_selection(client: TestClient):
    pid, t = sample(client)
    res = client.post(
        f"/api/projects/{pid}/tasks/{t['ออกแบบระบบ']}/chain",
        json={"steps": [{"name": "x", "enabled": False}]},
    )
    assert res.status_code == 422
    grp = client.post(
        f"/api/projects/{pid}/tasks/group", json={"name": "กลุ่ม", "taskIds": [t["ออกแบบระบบ"]]}
    ).json()
    gid = next(x["id"] for x in grp["tasks"] if x["name"] == "กลุ่ม")
    res = client.post(f"/api/projects/{pid}/tasks/{gid}/chain", json={"steps": STEPS})
    assert res.status_code == 422 and "กลุ่ม" in res.json()["error"]["message"]
