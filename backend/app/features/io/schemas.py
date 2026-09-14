"""Import/Export document (docs/features.md IO-1, IO-2).

The export is self-contained: the project's editable state plus every resource the
project assigns. On import resources are matched by name so a file can move between
data folders without duplicating people.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.core.models import Baseline, CamelModel
from app.features.projects.state import ProjectState
from app.features.resources.models import Resource

EXPORT_FORMAT = "phaengan-project"
EXPORT_VERSION = 1


class ExportedProject(ProjectState):
    baseline: Baseline | None = None


class ProjectExport(CamelModel):
    format: str = EXPORT_FORMAT
    version: int = EXPORT_VERSION
    exported_at: datetime
    project: ExportedProject
    resources: list[Resource] = Field(default_factory=list)


class ImportBody(ProjectExport):
    """Same document; `name` overrides the project name (e.g. when importing a copy)."""

    name: str | None = Field(default=None, min_length=1, max_length=200)


class ImportResult(CamelModel):
    project_id: str
    created_resources: list[str]
    matched_resources: list[str]
