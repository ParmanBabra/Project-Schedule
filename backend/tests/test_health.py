from pathlib import Path

from fastapi.testclient import TestClient


def test_health_reports_ok_and_isolated_data_dir(client: TestClient, data_dir: Path) -> None:
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert Path(body["dataDir"]) == data_dir
    assert (data_dir / "projects").is_dir()
