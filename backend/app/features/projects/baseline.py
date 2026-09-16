"""Baseline endpoints (docs/features.md BUF-5, SET-3)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.core.errors import ValidationFailed
from app.core.models import Baseline, BaselineRelease, BaselineTask, utcnow
from app.features.scheduling.engine import compute_schedule

from .repository import ProjectRepository, get_repo
from .schemas import ProjectOut
from .service import validate_and_save

router = APIRouter(prefix="/projects/{project_id}/baseline", tags=["projects"])


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def save_baseline(project_id: str, repo: ProjectRepository = Depends(get_repo)) -> ProjectOut:
    """Freeze today's plan: planned end and every task's dates."""
    project = repo.get(project_id)
    schedule = compute_schedule(project)
    if schedule.summary.planned_end is None:
        raise ValidationFailed("add tasks before saving a baseline")
    project.baseline = Baseline(
        saved_at=utcnow(),
        planned_end=schedule.summary.planned_end,
        chain_days=schedule.summary.chain_days,
        buffer_days=schedule.buffer.days,
        tasks={
            tid: BaselineTask(start=s.start, end=s.end)
            for tid, s in schedule.tasks.items()
            if not s.is_summary
        },
        releases={
            r.id: BaselineRelease(planned_end=r.planned_end, buffer_days=r.days)
            for r in schedule.releases
            if r.planned_end is not None
        },
    )
    return validate_and_save(repo, project)


@router.delete("", response_model=ProjectOut)
def clear_baseline(project_id: str, repo: ProjectRepository = Depends(get_repo)) -> ProjectOut:
    project = repo.get(project_id)
    project.baseline = None
    return validate_and_save(repo, project)
