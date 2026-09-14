from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from pydantic import Field

from app.core.models import Assignment, BufferSettings, CamelModel, Dependency, Rules, Task
from app.features.projects.repository import ProjectRepository, get_repo

from .engine import compute_schedule
from .schemas import Schedule

router = APIRouter(prefix="/projects/{project_id}/schedule", tags=["scheduling"])


class ScheduleDraft(CamelModel):
    """Partial project used for what-if previews while dragging. Nothing is saved."""

    start_date: date | None = None
    holidays: list[date] | None = None
    working_days: list[int] | None = None
    tasks: list[Task] | None = None
    dependencies: list[Dependency] | None = None
    assignments: list[Assignment] | None = None
    buffer: BufferSettings | None = None
    rules: Rules | None = None
    patch_tasks: list[Task] = Field(default_factory=list)  # replace matching ids only


@router.get("", response_model=Schedule)
def get_schedule(project_id: str, repo: ProjectRepository = Depends(get_repo)) -> Schedule:
    return compute_schedule(repo.get(project_id))


@router.post("/preview", response_model=Schedule)
def preview_schedule(
    project_id: str, body: ScheduleDraft, repo: ProjectRepository = Depends(get_repo)
) -> Schedule:
    project = repo.get(project_id).model_copy(deep=True)
    for key in body.model_fields_set - {"patch_tasks"}:
        value = getattr(body, key)
        if value is not None:
            setattr(project, key, value)
    if body.patch_tasks:
        patched = {t.id: t for t in body.patch_tasks}
        project.tasks = [patched.get(t.id, t) for t in project.tasks]
    return compute_schedule(project)
