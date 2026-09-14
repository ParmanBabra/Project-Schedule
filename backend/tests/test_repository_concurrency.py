"""Concurrent requests must never lose a project from the index or corrupt a file.

Every request builds its own ProjectRepository (see `get_repo`), so each thread here
uses a fresh instance: the locks have to be process-wide for this to pass.
"""

import threading
from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.models import Project
from app.features.projects.repository import ProjectRepository


def test_parallel_saves_from_separate_repositories_keep_every_project(tmp_path: Path):
    errors: list[BaseException] = []

    def worker(n: int) -> None:
        try:
            repo = ProjectRepository(tmp_path)  # fresh instance, like a real request
            for i in range(10):
                repo.save(
                    Project(id=f"prj_{n}_{i}", name=f"p{n}-{i}", start_date=date(2026, 9, 14))
                )
        except BaseException as exc:  # noqa: BLE001 - we want to surface anything
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(n,)) for n in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert errors == [], errors
    assert len({e.id for e in ProjectRepository(tmp_path).list_index()}) == 40


def test_parallel_api_creates_all_appear_in_list(client: TestClient):
    results: list[int] = []

    def worker(n: int) -> None:
        for i in range(5):
            res = client.post(
                "/api/projects", json={"name": f"p{n}-{i}", "startDate": "2026-09-14"}
            )
            results.append(res.status_code)

    threads = [threading.Thread(target=worker, args=(n,)) for n in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert results == [201] * 20
    assert len(client.get("/api/projects").json()) == 20
