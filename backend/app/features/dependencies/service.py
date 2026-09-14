from __future__ import annotations

from app.core.errors import NotFound, ValidationFailed
from app.core.ids import new_id
from app.core.models import Dependency, Project
from app.features.projects.repository import ProjectRepository
from app.features.projects.schemas import ProjectOut
from app.features.projects.service import validate_and_save

from .schemas import DependencyCreate, DependencyUpdate


def _dep(project: Project, dep_id: str) -> Dependency:
    for d in project.dependencies:
        if d.id == dep_id:
            return d
    raise NotFound(f"dependency {dep_id} not found")


def add_dependency(repo: ProjectRepository, project_id: str, body: DependencyCreate) -> ProjectOut:
    project = repo.get(project_id)
    ids = project.task_by_id()
    if body.from_ not in ids or body.to not in ids:
        raise NotFound("task not found")
    if body.from_ == body.to:
        raise ValidationFailed("a task cannot depend on itself")
    if any(d.from_ == body.from_ and d.to == body.to for d in project.dependencies):
        raise ValidationFailed("dependency already exists")
    existing = {d.id for d in project.dependencies}
    did = new_id("d")
    while did in existing:
        did = new_id("d")
    default = project.rules.default_dependency
    dep = Dependency(
        id=did,
        **{"from": body.from_},
        to=body.to,
        type=body.type or default.type,
        lag=body.lag if body.lag is not None else default.lag,
    )
    project.dependencies.append(dep)
    return validate_and_save(repo, project)


def update_dependency(
    repo: ProjectRepository, project_id: str, dep_id: str, body: DependencyUpdate
) -> ProjectOut:
    project = repo.get(project_id)
    dep = _dep(project, dep_id)
    if body.type is not None:
        dep.type = body.type
    if body.lag is not None:
        dep.lag = body.lag
    return validate_and_save(repo, project)


def delete_dependency(repo: ProjectRepository, project_id: str, dep_id: str) -> ProjectOut:
    project = repo.get(project_id)
    _dep(project, dep_id)
    project.dependencies = [d for d in project.dependencies if d.id != dep_id]
    return validate_and_save(repo, project)
