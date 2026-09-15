from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.features.projects.repository import ProjectRepository, get_repo
from app.features.projects.schemas import ProjectOut

from . import service
from .schemas import EpicBulkCreate, EpicCreate, EpicMembersBody, EpicUpdate

router = APIRouter(prefix="/projects/{project_id}/epics", tags=["epics"])


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_epic(
    project_id: str, body: EpicCreate, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.create_epic(repo, project_id, body)


@router.post("/bulk", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_epics(
    project_id: str, body: EpicBulkCreate, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.create_epics(repo, project_id, body)


@router.patch("/{task_id}", response_model=ProjectOut)
def update_epic(
    project_id: str, task_id: str, body: EpicUpdate, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.update_epic(repo, project_id, task_id, body)


@router.post("/{task_id}/convert", response_model=ProjectOut)
def convert_group(
    project_id: str, task_id: str, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.convert_group(repo, project_id, task_id)


@router.post("/{task_id}/members", response_model=ProjectOut)
def add_members(
    project_id: str,
    task_id: str,
    body: EpicMembersBody,
    repo: ProjectRepository = Depends(get_repo),
) -> ProjectOut:
    return service.add_members(repo, project_id, task_id, body)
