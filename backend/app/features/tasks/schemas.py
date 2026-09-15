from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.core.models import CamelModel, ChainStep, Constraint, EpicInfo, Estimate


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
    checklist: list[ChecklistItemIn] | None = None  # full replace (order = list order)
    progress_from_checklist: bool | None = None
    epic: EpicInfo | None = None  # set/replace the Epic info of a group
    clear_epic: bool = False  # turn an Epic back into a plain group


class ChecklistItemIn(CamelModel):
    id: str | None = None  # omitted for new items; the server assigns one
    text: str = Field(min_length=1, max_length=300)
    done: bool = False


class ChainBody(CamelModel):
    """Create a chain of tasks after `task_id` (TSK-9)."""

    steps: list[ChainStep] = Field(
        min_length=1
    )  # rows as shown in the dialog; only enabled ones are created
    prefix_with_source: bool = True  # "<source> – <step>"
    group_name: str | None = Field(
        default=None, min_length=1, max_length=200
    )  # wrap source + steps in a new group
    copy_assignees: bool = False
    remember: bool = True  # store `steps` as the project's chain template


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
