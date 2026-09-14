import threading
from pathlib import Path

from app.core.storage import JsonStore


def test_write_and_read_roundtrip_is_atomic(tmp_path: Path):
    store = JsonStore(tmp_path)
    target = tmp_path / "projects" / "p.json"
    store.write_json(target, {"name": "แผนงาน", "n": 1})
    assert store.read_json(target) == {"name": "แผนงาน", "n": 1}
    assert list(target.parent.glob("*.tmp")) == []


def test_missing_file_reads_as_none(tmp_path: Path):
    assert JsonStore(tmp_path).read_json(tmp_path / "nope.json") is None


def test_backups_rotate_and_keep_newest(tmp_path: Path):
    store = JsonStore(tmp_path)
    target = tmp_path / "p.json"
    backups = tmp_path / "backups" / "p"
    for i in range(25):
        store.write_json(target, {"v": i}, backup_dir=backups, keep=20)
    files = sorted(backups.glob("*.json"))
    assert len(files) == 20
    # the newest backup holds the previous version (v=23), the oldest v=4
    import json

    assert json.loads(files[-1].read_text(encoding="utf-8")) == {"v": 23}
    assert json.loads(files[0].read_text(encoding="utf-8")) == {"v": 4}


def test_move_to_trash_keeps_content(tmp_path: Path):
    store = JsonStore(tmp_path)
    target = tmp_path / "p.json"
    store.write_json(target, {"v": 1})
    moved = store.move_to_trash(target, tmp_path / "trash")
    assert moved is not None and moved.exists() and not target.exists()
    assert store.read_json(moved) == {"v": 1}
    assert store.move_to_trash(target, tmp_path / "trash") is None


def test_concurrent_writes_never_corrupt_file(tmp_path: Path):
    store = JsonStore(tmp_path)
    target = tmp_path / "p.json"

    def worker(n: int) -> None:
        for i in range(30):
            store.write_json(target, {"worker": n, "i": i, "pad": "x" * 2000})

    threads = [threading.Thread(target=worker, args=(n,)) for n in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    data = store.read_json(target)
    assert data is not None and data["i"] == 29 and len(data["pad"]) == 2000
    assert list(tmp_path.glob("*.tmp")) == []
