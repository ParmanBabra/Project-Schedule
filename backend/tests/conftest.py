"""Shared pytest fixtures.

Every test gets an isolated DATA_DIR so tests never touch real project files and
can run in parallel or in any order.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    return tmp_path / "data"


@pytest.fixture()
def client(data_dir: Path) -> Iterator[TestClient]:
    # Import inside the fixture so DATA_DIR is already patched when the app starts.
    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c


@pytest.fixture(autouse=True)
def _no_real_data_dir(monkeypatch: pytest.MonkeyPatch) -> None:
    """Safety net: a test that forgets the `data_dir` fixture still cannot write to ./data."""
    if "DATA_DIR" not in os.environ:
        fallback = Path(os.environ.get("TMP", "/tmp")) / "phaengan-test-data"
        monkeypatch.setenv("DATA_DIR", str(fallback))
