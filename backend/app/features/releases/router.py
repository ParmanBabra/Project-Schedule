from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.features.projects.repository import ProjectRepository, get_repo
from app.features.projects.schemas import ProjectOut

from . import service
from .schemas import ReleaseCreate, ReleaseUpdate

router = APIRouter(prefix="/projects/{project_id}/releases", tags=["releases"])


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_release(
    project_id: str, body: ReleaseCreate, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.create_release(repo, project_id, body)


@router.patch("/{release_id}", response_model=ProjectOut)
def update_release(
    project_id: str,
    release_id: str,
    body: ReleaseUpdate,
    repo: ProjectRepository = Depends(get_repo),
) -> ProjectOut:
    return service.update_release(repo, project_id, release_id, body)


@router.delete("/{release_id}", response_model=ProjectOut)
def delete_release(
    project_id: str, release_id: str, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.delete_release(repo, project_id, release_id)
