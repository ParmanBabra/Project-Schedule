from fastapi.testclient import TestClient

from tests.api_helpers import add_dep, add_task, create_project


def test_add_uses_project_default_type_and_lag(client: TestClient):
    pid = create_project(client)["id"]
    client.patch(f"/api/projects/{pid}/rules", json={"defaultDependency": {"type": "SS", "lag": 1}})
    a, _ = add_task(client, pid, "A", 3)
    b, _ = add_task(client, pid, "B", 2)
    body = add_dep(client, pid, a, b)
    d = body["dependencies"][0]
    assert d["type"] == "SS" and d["lag"] == 1 and d["from"] == a and d["to"] == b
    assert body["schedule"]["tasks"][b]["start"] == "2026-09-15"


def test_update_and_delete(client: TestClient):
    pid = create_project(client)["id"]
    a, _ = add_task(client, pid, "A", 3)
    b, _ = add_task(client, pid, "B", 2)
    did = add_dep(client, pid, a, b)["dependencies"][0]["id"]
    res = client.patch(f"/api/projects/{pid}/dependencies/{did}", json={"type": "FF", "lag": 0})
    assert res.status_code == 200 and res.json()["schedule"]["tasks"][b]["end"] == "2026-09-16"
    res = client.delete(f"/api/projects/{pid}/dependencies/{did}")
    assert res.status_code == 200 and res.json()["dependencies"] == []
    assert client.delete(f"/api/projects/{pid}/dependencies/{did}").status_code == 404


def test_cycle_is_rejected_and_nothing_saved(client: TestClient):
    pid = create_project(client)["id"]
    a, _ = add_task(client, pid, "A")
    b, _ = add_task(client, pid, "B")
    c, _ = add_task(client, pid, "C")
    add_dep(client, pid, a, b)
    add_dep(client, pid, b, c)
    res = client.post(f"/api/projects/{pid}/dependencies", json={"from": c, "to": a})
    assert res.status_code == 422
    err = res.json()["error"]
    assert err["code"] == "cycle_detected" and set(err["details"]["path"]) == {a, b, c}
    assert len(client.get(f"/api/projects/{pid}").json()["dependencies"]) == 2


def test_duplicate_self_and_unknown_are_rejected(client: TestClient):
    pid = create_project(client)["id"]
    a, _ = add_task(client, pid, "A")
    b, _ = add_task(client, pid, "B")
    add_dep(client, pid, a, b)
    assert (
        client.post(f"/api/projects/{pid}/dependencies", json={"from": a, "to": b}).status_code
        == 422
    )
    assert (
        client.post(f"/api/projects/{pid}/dependencies", json={"from": a, "to": a}).status_code
        == 422
    )
    assert (
        client.post(f"/api/projects/{pid}/dependencies", json={"from": a, "to": "t_x"}).status_code
        == 404
    )


def test_dependency_within_wbs_branch_is_rejected(client: TestClient):
    pid = create_project(client)["id"]
    s, _ = add_task(client, pid, "S")
    a, _ = add_task(client, pid, "A", parentId=s)
    res = client.post(f"/api/projects/{pid}/dependencies", json={"from": a, "to": s})
    assert res.status_code == 422
