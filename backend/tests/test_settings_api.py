from fastapi.testclient import TestClient


def test_defaults_expose_rules_buffer_and_descriptions(client: TestClient):
    res = client.get("/api/settings/defaults")
    assert res.status_code == 200
    body = res.json()
    assert body["buffer"]["method"] == "ccpm" and body["buffer"]["ccpmRatio"] == 50
    assert body["rules"]["nearCriticalFloatDays"] == 0 and body["rules"]["lagUnit"] == "working"
    methods = {m["id"]: m for m in body["bufferMethods"]}
    assert set(methods) == {"ccpm", "percent", "pert"}
    assert methods["ccpm"]["recommended"] is True and "ถ้าราบรื่น" in methods["ccpm"]["what"]
    rule_ids = {r["id"] for r in body["ruleDescriptions"]}
    assert {"nearCriticalFloatDays", "lagUnit", "schedulingMode", "progressRollup"} <= rule_ids
    assert set(rule_ids) <= set(body["rules"].keys())
