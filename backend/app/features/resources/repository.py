"""Shared resources file: data/resources.json (docs/features.md §2.3)."""

from __future__ import annotations

from pathlib import Path

from app.core.config import data_dir
from app.core.errors import NotFound
from app.core.storage import JsonStore

from .models import Resource


class ResourceRepository:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root or data_dir()
        self.store = JsonStore(self.root)
        self.path = self.root / "resources.json"
        self.backups_dir = self.root / "backups" / "resources"

    def all(self) -> list[Resource]:
        data = self.store.read_json(self.path)
        if not data:
            return []
        return [Resource.model_validate(r) for r in data.get("resources", [])]

    def get(self, resource_id: str) -> Resource:
        for r in self.all():
            if r.id == resource_id:
                return r
        raise NotFound(f"resource {resource_id} not found")

    def save_all(self, resources: list[Resource]) -> None:
        payload = {"resources": [r.model_dump(mode="json") for r in resources]}
        self.store.write_json(self.path, payload, backup_dir=self.backups_dir, keep=20)

    def locked(self):
        return self.store.locked(self.path)


def get_resource_repo() -> ResourceRepository:
    return ResourceRepository()
