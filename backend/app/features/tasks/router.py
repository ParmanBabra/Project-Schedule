from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status

from app.features.projects.repository import ProjectRepository, get_repo
from app.features.projects.schemas import ProjectOut

from . import service
from .schemas import ChainBody, DeleteMode, GroupBody, MoveBody, ReorderBody, TaskCreate, TaskUpdate

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def add_task(
    project_id: str, body: TaskCreate, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.add_task(repo, project_id, body)


@router.patch("/reorder", response_model=ProjectOut)
def reorder(
    project_id: str, body: ReorderBody, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.reorder(repo, project_id, body)


@router.post("/group", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def group(
    project_id: str, body: GroupBody, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.group(repo, project_id, body)


@router.patch("/{task_id}", response_model=ProjectOut)
def update_task(
    project_id: str, task_id: str, body: TaskUpdate, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.update_task(repo, project_id, task_id, body)


@router.delete("/{task_id}", response_model=ProjectOut)
def delete_task(
    project_id: str,
    task_id: str,
    mode: DeleteMode = Query(default="lift"),
    repo: ProjectRepository = Depends(get_repo),
) -> ProjectOut:
    return service.delete_task(repo, project_id, task_id, mode)


@router.patch("/{task_id}/move", response_model=ProjectOut)
def move(
    project_id: str, task_id: str, body: MoveBody, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.move(repo, project_id, task_id, body)


@router.post("/{task_id}/chain", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_chain(
    project_id: str,
    task_id: str,
    body: ChainBody,
    dry_run: bool = Query(default=False, alias="dryRun"),
    repo: ProjectRepository = Depends(get_repo),
) -> ProjectOut:
    """With dryRun=true the would-be project (incl. schedule) is returned but not saved."""
    return service.create_chain(repo, project_id, task_id, body, dry_run)
