from __future__ import annotations

import re
from urllib.parse import quote

from fastapi import APIRouter, Depends, Response, status

from app.core.models import CamelModel
from app.features.projects.repository import ProjectRepository, get_repo
from app.features.projects.schemas import ProjectOut
from app.features.resources.repository import ResourceRepository, get_resource_repo

from . import service
from .schemas import ImportBody, ImportResult, ProjectExport

router = APIRouter(prefix="/projects", tags=["io"])


def _filename(name: str, ext: str) -> str:
    safe = re.sub(r"[\\/:*?\"<>|]+", "_", name).strip() or "project"
    return f"{safe}.{ext}"


def _attachment(name: str) -> dict[str, str]:
    return {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"}


class ImportOut(CamelModel):
    project: ProjectOut
    result: ImportResult


@router.post("/import", response_model=ImportOut, status_code=status.HTTP_201_CREATED)
def import_project(
    body: ImportBody,
    repo: ProjectRepository = Depends(get_repo),
    resources: ResourceRepository = Depends(get_resource_repo),
) -> ImportOut:
    project, result = service.import_project(repo, resources, body)
    return ImportOut(project=project, result=result)


@router.get("/{project_id}/export", response_model=ProjectExport)
def export_project(
    project_id: str,
    response: Response,
    repo: ProjectRepository = Depends(get_repo),
    resources: ResourceRepository = Depends(get_resource_repo),
) -> ProjectExport:
    doc = service.export_project(repo, resources, project_id)
    response.headers.update(_attachment(_filename(doc.project.name, "phaengan.json")))
    return doc


@router.get("/{project_id}/export.csv")
def export_csv(
    project_id: str,
    repo: ProjectRepository = Depends(get_repo),
    resources: ResourceRepository = Depends(get_resource_repo),
) -> Response:
    text = service.export_csv(repo, resources, project_id)
    name = _filename(repo.get(project_id).name, "csv")
    return Response(
        content=text.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers=_attachment(name),
    )
