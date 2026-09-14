from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status

from app.features.projects.repository import ProjectRepository, get_repo

from . import service
from .models import Resource, ResourceCreate, ResourceOut, ResourceUpdate, WorkloadResponse
from .repository import ResourceRepository, get_resource_repo

router = APIRouter(prefix="/resources", tags=["resources"])


@router.get("", response_model=list[ResourceOut])
def list_resources(
    repo: ResourceRepository = Depends(get_resource_repo),
    projects: ProjectRepository = Depends(get_repo),
) -> list[ResourceOut]:
    return service.list_resources(repo, projects)


@router.post("", response_model=Resource, status_code=status.HTTP_201_CREATED)
def create_resource(
    body: ResourceCreate, repo: ResourceRepository = Depends(get_resource_repo)
) -> Resource:
    return service.create_resource(repo, body)


@router.get("/workload", response_model=WorkloadResponse)
def get_workload(
    from_: date = Query(alias="from"),
    to: date = Query(),
    project_id: str | None = Query(default=None, alias="projectId"),
    resource_ids: list[str] | None = Query(default=None, alias="resourceId"),
    repo: ResourceRepository = Depends(get_resource_repo),
    projects: ProjectRepository = Depends(get_repo),
) -> WorkloadResponse:
    return service.workload(repo, projects, from_, to, project_id, resource_ids)


@router.patch("/{resource_id}", response_model=Resource)
def update_resource(
    resource_id: str, body: ResourceUpdate, repo: ResourceRepository = Depends(get_resource_repo)
) -> Resource:
    return service.update_resource(repo, resource_id, body)


@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource(
    resource_id: str,
    force: bool = Query(default=False),
    repo: ResourceRepository = Depends(get_resource_repo),
    projects: ProjectRepository = Depends(get_repo),
) -> Response:
    service.delete_resource(repo, projects, resource_id, force)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
