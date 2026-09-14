from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.features.projects.repository import ProjectRepository, get_repo
from app.features.projects.schemas import ProjectOut

from . import service
from .schemas import DependencyCreate, DependencyUpdate

router = APIRouter(prefix="/projects/{project_id}/dependencies", tags=["dependencies"])


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def add_dependency(
    project_id: str, body: DependencyCreate, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.add_dependency(repo, project_id, body)


@router.patch("/{dep_id}", response_model=ProjectOut)
def update_dependency(
    project_id: str,
    dep_id: str,
    body: DependencyUpdate,
    repo: ProjectRepository = Depends(get_repo),
) -> ProjectOut:
    return service.update_dependency(repo, project_id, dep_id, body)


@router.delete("/{dep_id}", response_model=ProjectOut)
def delete_dependency(
    project_id: str, dep_id: str, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.delete_dependency(repo, project_id, dep_id)
