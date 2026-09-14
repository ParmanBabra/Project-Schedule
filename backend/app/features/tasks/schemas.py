from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.core.models import CamelModel, Constraint, Estimate


class TaskCreate(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    duration: int = Field(default=1, ge=0, le=3650)
    progress: int = Field(default=0, ge=0, le=100)
    is_milestone: bool = False
    parent_id: str | None = None
    constraint: Constraint | None = None
    color: str | None = None
    estimate: Estimate | None = None
    after_id: str | None = None  # insert right after this sibling; default = last


class TaskUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    duration: int | None = Field(default=None, ge=0, le=3650)
    progress: int | None = Field(default=None, ge=0, le=100)
    is_milestone: bool | None = None
    constraint: Constraint | None = None
    clear_constraint: bool = False
    color: str | None = None
    collapsed: bool | None = None
    estimate: Estimate | None = None
    clear_estimate: bool = False


class ReorderBody(CamelModel):
    parent_id: str | None = None
    ids: list[str]


class GroupBody(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    task_ids: list[str] = Field(min_length=1)


class MoveBody(CamelModel):
    parent_id: str | None = None
    order: int | None = None  # 1-based position among new siblings; default = last


DeleteMode = Literal["lift", "cascade"]
