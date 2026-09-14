from __future__ import annotations

from app.core.errors import NotFound, ValidationFailed
from app.core.ids import new_id
from app.core.models import Assignment
from app.features.projects.repository import ProjectRepository
from app.features.projects.schemas import ProjectOut
from app.features.projects.service import validate_and_save
from app.features.resources.repository import ResourceRepository

from .schemas import AssignmentCreate, AssignmentUpdate


def add_assignment(
    repo: ProjectRepository, resources: ResourceRepository, project_id: str, body: AssignmentCreate
) -> ProjectOut:
    project = repo.get(project_id)
    if body.task_id not in project.task_by_id():
        raise NotFound(f"task {body.task_id} not found")
    resources.get(body.resource_id)  # raises NotFound
    if any(
        a.task_id == body.task_id and a.resource_id == body.resource_id for a in project.assignments
    ):
        raise ValidationFailed("resource already assigned to this task")
    existing = {a.id for a in project.assignments}
    aid = new_id("a")
    while aid in existing:
        aid = new_id("a")
    project.assignments.append(
        Assignment(id=aid, task_id=body.task_id, resource_id=body.resource_id, units=body.units)
    )
    return validate_and_save(repo, project)


def update_assignment(
    repo: ProjectRepository, project_id: str, assignment_id: str, body: AssignmentUpdate
) -> ProjectOut:
    project = repo.get(project_id)
    target = next((a for a in project.assignments if a.id == assignment_id), None)
    if target is None:
        raise NotFound(f"assignment {assignment_id} not found")
    target.units = body.units
    return validate_and_save(repo, project)


def delete_assignment(repo: ProjectRepository, project_id: str, assignment_id: str) -> ProjectOut:
    project = repo.get(project_id)
    if not any(a.id == assignment_id for a in project.assignments):
        raise NotFound(f"assignment {assignment_id} not found")
    project.assignments = [a for a in project.assignments if a.id != assignment_id]
    return validate_and_save(repo, project)
