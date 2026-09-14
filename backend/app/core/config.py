"""Runtime configuration.

All paths are resolved relative to the repository root so the app works the same
whether started from `backend/` or from the repo root. `DATA_DIR` can be overridden
with the environment variable of the same name (tests point it at a temp folder).
"""

from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]


def data_dir() -> Path:
    """Folder holding all JSON data files. Created on first use."""
    raw = os.environ.get("DATA_DIR")
    path = Path(raw) if raw else REPO_ROOT / "data"
    path.mkdir(parents=True, exist_ok=True)
    (path / "projects").mkdir(exist_ok=True)
    return path


APP_TITLE = "แผนงาน API"
APP_VERSION = "0.1.0"
