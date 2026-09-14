"""File-based JSON storage.

Guarantees
- Atomic writes: data goes to a temp file in the same directory, then `os.replace`.
- Serialised writers per file inside this process (FastAPI runs sync endpoints in a
  thread pool). The app is single-user / single-process by design (docs/features.md).
- Backups: the previous version of a file is copied to `<backup_dir>/<timestamp>.json`
  before every overwrite; only the newest `keep` copies are retained.
- Trash: deletes move the file to a trash folder instead of unlinking it.
"""

from __future__ import annotations

import json
import os
import shutil
import threading
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any


class JsonStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self._locks: dict[str, threading.RLock] = {}
        self._locks_guard = threading.Lock()
        self._stamp_guard = threading.Lock()
        self._last_stamp = ""

    # ------------------------------------------------------------------ locking
    def lock_for(self, path: Path) -> threading.RLock:
        key = str(path.resolve())
        with self._locks_guard:
            lock = self._locks.get(key)
            if lock is None:
                lock = threading.RLock()
                self._locks[key] = lock
            return lock

    @contextmanager
    def locked(self, path: Path) -> Iterator[None]:
        lock = self.lock_for(path)
        lock.acquire()
        try:
            yield
        finally:
            lock.release()

    # --------------------------------------------------------------------- io
    def read_json(self, path: Path) -> Any | None:
        with self.locked(path):
            if not path.exists():
                return None
            with path.open("r", encoding="utf-8") as fh:
                return json.load(fh)

    def write_json(
        self,
        path: Path,
        data: Any,
        *,
        backup_dir: Path | None = None,
        keep: int = 20,
    ) -> None:
        with self.locked(path):
            path.parent.mkdir(parents=True, exist_ok=True)
            if backup_dir is not None and path.exists():
                self._backup(path, backup_dir, keep)
            tmp = path.with_name(f"{path.name}.{os.getpid()}.tmp")
            with tmp.open("w", encoding="utf-8") as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2)
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(tmp, path)

    def move_to_trash(self, path: Path, trash_dir: Path) -> Path | None:
        with self.locked(path):
            if not path.exists():
                return None
            trash_dir.mkdir(parents=True, exist_ok=True)
            target = trash_dir / f"{path.stem}-{self._stamp()}{path.suffix}"
            shutil.move(str(path), str(target))
            return target

    # ---------------------------------------------------------------- backups
    def _backup(self, path: Path, backup_dir: Path, keep: int) -> None:
        backup_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, backup_dir / f"{self._stamp()}.json")
        backups = sorted(backup_dir.glob("*.json"))
        for old in backups[:-keep] if keep > 0 else backups:
            old.unlink(missing_ok=True)

    def _stamp(self) -> str:
        """Monotonic, filesystem-safe timestamp (never repeats within a process)."""
        with self._stamp_guard:
            stamp = (
                time.strftime("%Y%m%dT%H%M%S") + f"{int(time.time() * 1_000_000) % 1_000_000:06d}"
            )
            if stamp <= self._last_stamp:
                stamp = f"{self._last_stamp[:-6]}{int(self._last_stamp[-6:]) + 1:06d}"
            self._last_stamp = stamp
            return stamp
