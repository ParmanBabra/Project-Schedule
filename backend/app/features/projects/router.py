from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.core.models import BufferSettings, CamelModel, Rules

from . import service
from .repository import ProjectRepository, get_repo
from .schemas import ProjectCreate, ProjectListItem, ProjectOut, ProjectUpdate
from .state import ProjectState

router = APIRouter(prefix="/projects", tags=["projects"])


class DuplicateBody(CamelModel):
    name: str | None = None


@router.get("", response_model=list[ProjectListItem])
def list_projects(repo: ProjectRepository = Depends(get_repo)) -> list[ProjectListItem]:
    return service.list_projects(repo)


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectCreate, repo: ProjectRepository = Depends(get_repo)) -> ProjectOut:
    return service.create_project(repo, body)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, repo: ProjectRepository = Depends(get_repo)) -> ProjectOut:
    return service.get_project(repo, project_id)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str, body: ProjectUpdate, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.update_project(repo, project_id, body)


@router.put("/{project_id}", response_model=ProjectOut)
def replace_project_state(
    project_id: str, body: ProjectState, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.replace_state(repo, project_id, body)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, repo: ProjectRepository = Depends(get_repo)) -> Response:
    service.delete_project(repo, project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{project_id}/duplicate", response_model=ProjectOut, status_code=status.HTTP_201_CREATED
)
def duplicate_project(
    project_id: str, body: DuplicateBody | None = None, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.duplicate_project(repo, project_id, body.name if body else None)


@router.patch("/{project_id}/rules", response_model=ProjectOut)
def update_rules(
    project_id: str, body: Rules, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.update_rules(repo, project_id, body)


@router.patch("/{project_id}/buffer", response_model=ProjectOut)
def update_buffer(
    project_id: str, body: BufferSettings, repo: ProjectRepository = Depends(get_repo)
) -> ProjectOut:
    return service.update_buffer(repo, project_id, body)
