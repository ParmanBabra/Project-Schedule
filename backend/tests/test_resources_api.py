from fastapi.testclient import TestClient

from tests.api_helpers import add_task, create_project, sample


def make_resource(client: TestClient, name: str, **extra) -> dict:
    res = client.post("/api/resources", json={"name": name, **extra})
    assert res.status_code == 201, res.text
    return res.json()


def test_resource_crud_and_color_rotation(client: TestClient):
    a = make_resource(client, "สมชาย")
    b = make_resource(client, "สุดา", type="person", capacityPerDay=50)
    assert a["color"] != b["color"] and a["id"].startswith("r_")
    res = client.patch(
        f"/api/resources/{a['id']}", json={"name": "สมชาย ใจดี", "daysOff": ["2026-09-25"]}
    )
    assert res.status_code == 200 and res.json()["daysOff"] == ["2026-09-25"]
    listed = client.get("/api/resources").json()
    assert [r["name"] for r in listed] == ["สมชาย ใจดี", "สุดา"]
    assert listed[0]["assignmentCount"] == 0
    assert client.delete(f"/api/resources/{b['id']}").status_code == 204
    assert client.patch(f"/api/resources/{b['id']}", json={"name": "x"}).status_code == 404


def test_assign_update_and_remove(client: TestClient):
    pid, t = sample(client)
    r = make_resource(client, "สมชาย")
    res = client.post(
        f"/api/projects/{pid}/assignments",
        json={"taskId": t["ออกแบบระบบ"], "resourceId": r["id"], "units": 100},
    )
    assert res.status_code == 201
    asg = res.json()["assignments"][0]
    assert asg["units"] == 100
    dup = client.post(
        f"/api/projects/{pid}/assignments", json={"taskId": t["ออกแบบระบบ"], "resourceId": r["id"]}
    )
    assert dup.status_code == 422
    missing = client.post(
        f"/api/projects/{pid}/assignments", json={"taskId": t["ออกแบบระบบ"], "resourceId": "r_x"}
    )
    assert missing.status_code == 404
    res = client.patch(f"/api/projects/{pid}/assignments/{asg['id']}", json={"units": 50})
    assert res.json()["assignments"][0]["units"] == 50
    assert client.get("/api/resources").json()[0]["assignmentCount"] == 1
    res = client.delete(f"/api/projects/{pid}/assignments/{asg['id']}")
    assert res.status_code == 200 and res.json()["assignments"] == []


def test_delete_assigned_resource_needs_force(client: TestClient):
    pid, t = sample(client)
    r = make_resource(client, "สมชาย")
    client.post(
        f"/api/projects/{pid}/assignments", json={"taskId": t["ออกแบบระบบ"], "resourceId": r["id"]}
    )
    res = client.delete(f"/api/resources/{r['id']}")
    assert res.status_code == 409 and res.json()["error"]["details"]["projects"][0]["id"] == pid
    assert client.delete(f"/api/resources/{r['id']}?force=true").status_code == 204
    assert client.get(f"/api/projects/{pid}").json()["assignments"] == []


def test_workload_sums_across_projects_and_flags_overallocation(client: TestClient):
    pid, t = sample(client)
    r = make_resource(client, "สุดา")
    # ออกแบบ UI 17–22 Sep and พัฒนา Frontend 23–29 Sep in this project, 100% each
    client.post(
        f"/api/projects/{pid}/assignments", json={"taskId": t["ออกแบบ UI"], "resourceId": r["id"]}
    )
    client.post(
        f"/api/projects/{pid}/assignments",
        json={"taskId": t["พัฒนา Frontend"], "resourceId": r["id"]},
    )
    # another project with a 5-day task from 21 Sep at 60%
    other = create_project(client, name="อื่น", start="2026-09-21")["id"]
    tid, _ = add_task(client, other, "งานแทรก", 5)
    client.post(
        f"/api/projects/{other}/assignments",
        json={"taskId": tid, "resourceId": r["id"], "units": 60},
    )

    res = client.get(f"/api/resources/workload?from=2026-09-14&to=2026-09-30&projectId={pid}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["threshold"] == 100
    days = {d["date"]: d for d in body["resources"][0]["days"]}
    assert days["2026-09-16"]["load"] == 0
    assert days["2026-09-17"]["load"] == 100 and not days["2026-09-17"]["over"]
    assert days["2026-09-21"]["load"] == 160 and days["2026-09-21"]["over"]
    assert days["2026-09-19"]["load"] == 0  # weekend: nothing scheduled
    assert {i["projectName"] for i in days["2026-09-22"]["items"]} == {"ระบบจองห้องประชุม", "อื่น"}
    over_dates = [o["date"] for o in body["overallocations"]]
    assert over_dates == ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"]
    assert body["resources"][0]["peak"] == 160 and body["resources"][0]["overDays"] == 5

    # raising the project's threshold to 200% clears the warnings
    client.patch(f"/api/projects/{pid}/rules", json={"overallocationThreshold": 200})
    body = client.get(
        f"/api/resources/workload?from=2026-09-14&to=2026-09-30&projectId={pid}"
    ).json()
    assert body["threshold"] == 200 and body["overallocations"] == []


def test_workload_day_off_is_overallocated_when_assigned(client: TestClient):
    pid, t = sample(client)
    r = make_resource(client, "วิชัย", daysOff=["2026-09-17"])
    client.post(
        f"/api/projects/{pid}/assignments", json={"taskId": t["ออกแบบระบบ"], "resourceId": r["id"]}
    )
    body = client.get("/api/resources/workload?from=2026-09-17&to=2026-09-18").json()
    d17, d18 = body["resources"][0]["days"]
    assert d17["off"] and d17["over"] and d17["capacity"] == 0
    assert not d18["over"]
    assert client.get("/api/resources/workload?from=2026-09-18&to=2026-09-17").status_code == 422
