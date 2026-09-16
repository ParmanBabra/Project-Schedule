"""Releases: delivery milestones that carry their own schedule buffer (docs/features.md BUF-8)."""

from __future__ import annotations

from app.core.errors import NotFound, ValidationFailed
from app.core.models import Project, Release, Task
from app.features.projects.repository import ProjectRepository
from app.features.projects.schemas import ProjectOut
from app.features.projects.service import validate_and_save
from app.features.scheduling.engine import build_tree

from .schemas import ReleaseCreate, ReleaseUpdate


def _release(project: Project, release_id: str) -> Release:
    for r in project.releases:
        if r.id == release_id:
            return r
    raise NotFound(f"release {release_id} not found")


def _milestone(project: Project, task_id: str, ignore: str | None = None) -> Task:
    """The task a release may point at: an existing leaf, used by no other release."""
    children, by_id = build_tree(project.tasks)
    task = by_id.get(task_id)
    if task is None:
        raise NotFound(f"task {task_id} not found")
    if children.get(task_id) or task.epic is not None:
        raise ValidationFailed("จุดส่งมอบต้องเป็นงานเดี่ยวหรือ milestone ไม่ใช่กลุ่มงาน")
    for r in project.releases:
        if r.id != ignore and r.milestone_task_id == task_id:
            raise ValidationFailed(f"งานนี้เป็นจุดส่งมอบของ {r.name!r} อยู่แล้ว")
    return task


def _new_id(project: Project) -> str:
    n = len(project.releases) + 1
    used = {r.id for r in project.releases}
    while f"rel_{n:02d}" in used:
        n += 1
    return f"rel_{n:02d}"


def create_release(repo: ProjectRepository, project_id: str, body: ReleaseCreate) -> ProjectOut:
    project = repo.get(project_id)
    _milestone(project, body.milestone_task_id)
    project.releases.append(
        Release(
            id=_new_id(project),
            name=body.name.strip(),
            milestone_task_id=body.milestone_task_id,
            days=body.days,
        )
    )
    return validate_and_save(repo, project)


def update_release(
    repo: ProjectRepository, project_id: str, release_id: str, body: ReleaseUpdate
) -> ProjectOut:
    project = repo.get(project_id)
    rel = _release(project, release_id)
    if body.name is not None:
        rel.name = body.name.strip()
    if body.milestone_task_id is not None:
        _milestone(project, body.milestone_task_id, ignore=release_id)
        rel.milestone_task_id = body.milestone_task_id
    if body.clear_days:
        rel.days = None
    elif body.days is not None:
        rel.days = body.days
    return validate_and_save(repo, project)


def delete_release(repo: ProjectRepository, project_id: str, release_id: str) -> ProjectOut:
    project = repo.get(project_id)
    _release(project, release_id)
    project.releases = [r for r in project.releases if r.id != release_id]
    if project.baseline is not None:
        project.baseline.releases.pop(release_id, None)
    return validate_and_save(repo, project)


def drop_releases_of(project: Project, task_ids: set[str]) -> None:
    """Called when tasks are deleted: a release cannot outlive its milestone."""
    gone = {r.id for r in project.releases if r.milestone_task_id in task_ids}
    if not gone:
        return
    project.releases = [r for r in project.releases if r.id not in gone]
    if project.baseline is not None:
        for rid in gone:
            project.baseline.releases.pop(rid, None)
