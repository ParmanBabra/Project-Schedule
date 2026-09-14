from __future__ import annotations

from datetime import date, datetime

from pydantic import Field

from app.core.models import BufferSettings, CamelModel, Project, Rules
from app.features.scheduling.schemas import Schedule


class ProjectCreate(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    start_date: date
    working_days: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5])
    holidays: list[date] = Field(default_factory=list)
    rules: Rules | None = None
    buffer: BufferSettings | None = None


class ProjectUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    start_date: date | None = None
    working_days: list[int] | None = None
    holidays: list[date] | None = None


class ProjectListItem(CamelModel):
    id: str
    name: str
    start_date: date
    planned_end: date | None
    committed_end: date | None
    progress: int
    task_count: int
    critical_count: int
    updated_at: datetime


class ProjectOut(Project):
    schedule: Schedule
