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
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any


def _retry_windows(fn: Callable[[], Any], attempts: int = 30, delay: float = 0.01) -> Any:
    """Windows briefly denies access to files that were just written (indexer/AV scans),
    so rename/copy right after a write can raise PermissionError. Retry with backoff."""
    for attempt in range(attempts):
        try:
            return fn()
        except PermissionError:
            if attempt == attempts - 1:
                raise
            time.sleep(delay * (1 + attempt % 5))
    return None


# Process-wide lock registry. A JsonStore is cheap and created per request, so the
# locks must NOT live on the instance or two requests would never contend.
_LOCKS: dict[str, threading.RLock] = {}
_LOCKS_GUARD = threading.Lock()
_STAMP_GUARD = threading.Lock()
_LAST_STAMP = [""]


class JsonStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ locking
    def lock_for(self, path: Path) -> threading.RLock:
        key = str(path.resolve())
        with _LOCKS_GUARD:
            lock = _LOCKS.get(key)
            if lock is None:
                lock = threading.RLock()
                _LOCKS[key] = lock
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
            tmp = path.with_name(f"{path.name}.{os.getpid()}.{threading.get_ident()}.tmp")
            with tmp.open("w", encoding="utf-8") as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2)
                fh.flush()
                os.fsync(fh.fileno())
            _retry_windows(lambda: os.replace(tmp, path))

    def move_to_trash(self, path: Path, trash_dir: Path) -> Path | None:
        with self.locked(path):
            if not path.exists():
                return None
            trash_dir.mkdir(parents=True, exist_ok=True)
            target = trash_dir / f"{path.stem}-{self._stamp()}{path.suffix}"
            _retry_windows(lambda: shutil.move(str(path), str(target)))
            return target

    # ---------------------------------------------------------------- backups
    def _backup(self, path: Path, backup_dir: Path, keep: int) -> None:
        backup_dir.mkdir(parents=True, exist_ok=True)
        dest = backup_dir / f"{self._stamp()}.json"
        _retry_windows(lambda: shutil.copy2(path, dest))
        backups = sorted(backup_dir.glob("*.json"))
        for old in backups[:-keep] if keep > 0 else backups:
            old.unlink(missing_ok=True)

    def _stamp(self) -> str:
        """Monotonic, filesystem-safe timestamp (never repeats within a process)."""
        with _STAMP_GUARD:
            stamp = (
                time.strftime("%Y%m%dT%H%M%S") + f"{int(time.time() * 1_000_000) % 1_000_000:06d}"
            )
            if stamp <= _LAST_STAMP[0]:
                stamp = f"{_LAST_STAMP[0][:-6]}{int(_LAST_STAMP[0][-6:]) + 1:06d}"
            _LAST_STAMP[0] = stamp
            return stamp
