"""Project persistence: one JSON file per project + an index file (docs/features.md §2.1)."""

from __future__ import annotations

from pathlib import Path

from app.core.config import data_dir
from app.core.errors import NotFound
from app.core.models import IndexEntry, Project, utcnow
from app.core.storage import JsonStore

BACKUPS_TO_KEEP = 20


class ProjectRepository:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root or data_dir()
        self.store = JsonStore(self.root)
        self.projects_dir = self.root / "projects"
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        self.index_path = self.root / "index.json"
        self.backups_dir = self.root / "backups"
        self.trash_dir = self.root / "trash"

    # ------------------------------------------------------------- paths
    def path_for(self, project_id: str) -> Path:
        return self.projects_dir / f"{project_id}.json"

    # ------------------------------------------------------------- index
    def list_index(self) -> list[IndexEntry]:
        raw = self.store.read_json(self.index_path)
        if raw is None:
            return self._rebuild_index()
        entries = [IndexEntry.model_validate(e) for e in raw.get("projects", [])]
        return sorted(entries, key=lambda e: e.updated_at, reverse=True)

    def _rebuild_index(self) -> list[IndexEntry]:
        entries: list[IndexEntry] = []
        for file in sorted(self.projects_dir.glob("*.json")):
            data = self.store.read_json(file)
            if data:
                p = Project.model_validate(data)
                entries.append(IndexEntry(id=p.id, name=p.name, updated_at=p.updated_at))
        self._write_index(entries)
        return entries

    def _write_index(self, entries: list[IndexEntry]) -> None:
        payload = {"projects": [e.model_dump(mode="json") for e in entries]}
        self.store.write_json(self.index_path, payload)

    def _upsert_index(self, project: Project) -> None:
        with self.store.locked(self.index_path):  # read-modify-write as one unit
            entries = [e for e in self.list_index() if e.id != project.id]
            entries.append(
                IndexEntry(id=project.id, name=project.name, updated_at=project.updated_at)
            )
            self._write_index(entries)

    # ------------------------------------------------------------- crud
    def exists(self, project_id: str) -> bool:
        return self.path_for(project_id).exists()

    def get(self, project_id: str) -> Project:
        data = self.store.read_json(self.path_for(project_id))
        if data is None:
            raise NotFound(f"project {project_id} not found")
        return Project.model_validate(data)

    def all(self) -> list[Project]:
        return [self.get(e.id) for e in self.list_index() if self.exists(e.id)]

    def save(self, project: Project) -> Project:
        project.updated_at = utcnow()
        self.store.write_json(
            self.path_for(project.id),
            project.model_dump(mode="json"),
            backup_dir=self.backups_dir / project.id,
            keep=BACKUPS_TO_KEEP,
        )
        self._upsert_index(project)
        return project

    def delete(self, project_id: str) -> None:
        if not self.exists(project_id):
            raise NotFound(f"project {project_id} not found")
        self.store.move_to_trash(self.path_for(project_id), self.trash_dir)
        with self.store.locked(self.index_path):
            self._write_index([e for e in self.list_index() if e.id != project_id])


def get_repo() -> ProjectRepository:
    """FastAPI dependency. Cheap to construct; reads DATA_DIR each time (tests patch it)."""
    return ProjectRepository()
