from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import Field

from app.core.models import CamelModel

ResourceType = Literal["person", "equipment"]

RESOURCE_COLORS = ["#6a4fd8", "#e0457b", "#1f9e89", "#f28c28", "#2e86de", "#a1519c", "#8a83a8"]


class Resource(CamelModel):
    id: str
    name: str = Field(min_length=1, max_length=120)
    type: ResourceType = "person"
    capacity_per_day: int = Field(default=100, ge=1, le=1000)
    color: str = Field(default="#6a4fd8", pattern=r"^#[0-9a-fA-F]{6}$")
    days_off: list[date] = Field(default_factory=list)


class ResourceCreate(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    type: ResourceType = "person"
    capacity_per_day: int = Field(default=100, ge=1, le=1000)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    days_off: list[date] = Field(default_factory=list)


class ResourceUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: ResourceType | None = None
    capacity_per_day: int | None = Field(default=None, ge=1, le=1000)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    days_off: list[date] | None = None


class ResourceOut(Resource):
    assignment_count: int = 0
    project_count: int = 0


class WorkloadItem(CamelModel):
    project_id: str
    project_name: str
    task_id: str
    task_name: str
    units: int


class WorkloadDay(CamelModel):
    date: date
    load: int
    capacity: int
    over: bool
    off: bool
    items: list[WorkloadItem]


class ResourceWorkload(CamelModel):
    resource: Resource
    days: list[WorkloadDay]
    peak: int
    over_days: int


class Overallocation(CamelModel):
    resource_id: str
    resource_name: str
    date: date
    load: int
    capacity: int
    items: list[WorkloadItem]


class WorkloadResponse(CamelModel):
    from_: date = Field(alias="from")
    to: date
    threshold: int
    resources: list[ResourceWorkload]
    overallocations: list[Overallocation]
