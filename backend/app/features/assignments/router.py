from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.features.projects.repository import ProjectRepository, get_repo
from app.features.projects.schemas import ProjectOut
from app.features.resources.repository import ResourceRepository, get_resource_repo

from . import service
from .schemas import AssignmentCreate, AssignmentUpdate

router = APIRouter(prefix="/projects/{project_id}/assignments", tags=["assignments"])


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def add_assignment(
    project_id: str,
    body: AssignmentCreate,
    repo: ProjectRepository = Depends(get_repo),
    resources: ResourceRepository = Depends(get_resource_repo),
) -> ProjectOut:
    return service.add_assignment(repo, resources, project_id, body)


@router.patch("/{assignment_id}", response_model=ProjectOut)
def update_assignment(
    project_id: str,
    assignment_id: str,
    body: AssignmentUpdate,
    repo: ProjectRepository = Depends(get_repo),
) -> ProjectOut:
    return service.update_assignment(repo, project_id, assignment_id, body)


@router.delete("/{assignment_id}", response_model=ProjectOut)
def delete_assignment(
    project_id: str, assignment_id: str, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.delete_assignment(repo, project_id, assignment_id)
