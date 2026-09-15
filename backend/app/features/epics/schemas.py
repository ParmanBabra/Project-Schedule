"""Epic = a group task carrying `EpicInfo` (docs/features.md EPIC-1..EPIC-5)."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.core.models import CamelModel


class EpicTaskIn(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    duration: int = Field(default=3, ge=0, le=3650)
    checklist: list[str] = Field(default_factory=list)  # sub-items ("- ..." lines from a paste)


class EpicCreate(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    color: str = Field(default="#6a4fd8", pattern=r"^#[0-9a-fA-F]{6}$")
    description: str = Field(default="", max_length=2000)
    owner_resource_id: str | None = None
    tasks: list[EpicTaskIn] = Field(default_factory=list)  # new tasks created inside
    existing_task_ids: list[str] = Field(default_factory=list)  # tasks moved inside
    sequential: bool = True  # new tasks linked FS in order
    position: Literal["end", "after"] = "end"
    after_task_id: str | None = (
        None  # with position="after": place the Epic after this top-level task
    )
    parent_id: str | None = None  # nest the Epic under another group/Epic


class EpicBulkCreate(CamelModel):
    epics: list[EpicCreate] = Field(min_length=1)
    link_epics: bool = False  # each Epic waits for the previous one (FS on the whole group)


class EpicUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    description: str | None = Field(default=None, max_length=2000)
    owner_resource_id: str | None = None
    clear_owner: bool = False


class EpicMembersBody(CamelModel):
    task_ids: list[str] = Field(min_length=1)
