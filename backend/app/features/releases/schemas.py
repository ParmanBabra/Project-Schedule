from __future__ import annotations

from pydantic import Field

from app.core.models import CamelModel


class ReleaseCreate(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    milestone_task_id: str
    days: int | None = Field(default=None, ge=0, le=3650)


class ReleaseUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    milestone_task_id: str | None = None
    days: int | None = Field(default=None, ge=0, le=3650)
    clear_days: bool = False  # back to the computed size
