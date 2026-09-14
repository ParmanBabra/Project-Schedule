from __future__ import annotations

from pydantic import Field

from app.core.models import CamelModel


class AssignmentCreate(CamelModel):
    task_id: str
    resource_id: str
    units: int = Field(default=100, ge=1, le=1000)


class AssignmentUpdate(CamelModel):
    units: int = Field(ge=1, le=1000)
