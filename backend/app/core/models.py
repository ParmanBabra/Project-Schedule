"""Shared domain models (pydantic v2).

The JSON on disk and the API both use camelCase; Python uses snake_case. Dates are
`datetime.date` internally and ISO `YYYY-MM-DD` on the wire (docs/features.md §2).
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

DependencyType = Literal["FS", "SS", "FF", "SF"]
BufferMethod = Literal["ccpm", "percent", "pert"]
RiskLevel = Literal["low", "medium", "high"]
ProgressRollup = Literal["duration", "count", "effort"]
LateDetection = Literal["linear", "baseline", "overdue"]
LagUnit = Literal["working", "calendar"]
SchedulingMode = Literal["auto", "manual"]
ReleaseSuccessors = Literal["immediate", "after_buffer"]  # BUF-9: successors of a release milestone

RISK_PERCENT: dict[str, int] = {"low": 10, "medium": 15, "high": 25}
PERT_Z: dict[int, float] = {84: 1.0, 98: 2.0}


def utcnow() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
        extra="ignore",
    )


class Constraint(CamelModel):
    """SNET = start no earlier than; FNLT = finish no later than (float may go negative)."""

    type: Literal["SNET", "FNLT"] = "SNET"
    date: date


class Estimate(CamelModel):
    """PERT three-point estimate in working days."""

    o: int = Field(ge=0)
    m: int = Field(ge=0)
    p: int = Field(ge=0)


class ChecklistItem(CamelModel):
    """Sub-item inside a task (TSK-8). Not a schedulable task: no dates, no dependencies."""

    id: str
    text: str = Field(min_length=1, max_length=300)
    done: bool = False


class ChainStep(CamelModel):
    """A remembered row of the "create task chain" dialog (TSK-9)."""

    name: str = Field(min_length=1, max_length=200)
    duration: int = Field(default=1, ge=0, le=3650)
    enabled: bool = True
    parallel: bool = False  # starts together with the previous step (SS) instead of after it


class EpicInfo(CamelModel):
    """Marks a group task as an Epic (docs/features.md EPIC-1): a theme with its own colour,
    goal and owner. Dates / progress still roll up from the tasks inside."""

    color: str = Field(default="#6a4fd8", pattern=r"^#[0-9a-fA-F]{6}$")
    description: str = Field(default="", max_length=2000)
    owner_resource_id: str | None = None


class Task(CamelModel):
    id: str
    name: str = Field(min_length=1, max_length=200)
    duration: int = Field(default=1, ge=0, le=3650)
    progress: int = Field(default=0, ge=0, le=100)
    is_milestone: bool = False
    constraint: Constraint | None = None
    color: str | None = None
    parent_id: str | None = None
    collapsed: bool = False
    order: int = 0
    estimate: Estimate | None = None
    checklist: list[ChecklistItem] = Field(default_factory=list)
    progress_from_checklist: bool = True
    epic: EpicInfo | None = None  # set => this task is an Epic (always a summary row)
    description: str = Field(default="", max_length=2000)  # free-text notes (TSK-2 หมายเหตุ)


class Dependency(CamelModel):
    id: str
    from_: str = Field(alias="from")
    to: str
    type: DependencyType = "FS"
    lag: int = Field(default=0, ge=-3650, le=3650)


class Assignment(CamelModel):
    id: str
    task_id: str
    resource_id: str
    units: int = Field(default=100, ge=1, le=1000)


class BufferSettings(CamelModel):
    method: BufferMethod = "ccpm"
    ccpm_ratio: int = Field(default=50, ge=10, le=100)
    risk_level: RiskLevel = "medium"
    percent: int | None = Field(default=None, ge=0, le=200)
    pert_confidence: Literal[84, 98] = 84
    days: int | None = Field(default=None, ge=0, le=3650)
    management_reserve_percent: int = Field(default=5, ge=0, le=100)


class DefaultDependency(CamelModel):
    type: DependencyType = "FS"
    lag: int = 0


class BufferZones(CamelModel):
    """Fever-chart zones (SET-10): consumed% / chain-progress% ratio thresholds."""

    yellow: int = Field(default=100, ge=50, le=300)
    red: int = Field(default=120, ge=60, le=400)


class Rules(CamelModel):
    near_critical_float_days: int = Field(default=0, ge=0, le=365)
    progress_rollup: ProgressRollup = "duration"
    late_detection: LateDetection = "linear"
    overallocation_threshold: int = Field(default=100, ge=50, le=200)
    lag_unit: LagUnit = "working"
    default_dependency: DefaultDependency = Field(default_factory=DefaultDependency)
    scheduling_mode: SchedulingMode = "auto"
    buffer_zones: BufferZones = Field(default_factory=BufferZones)
    release_successors: ReleaseSuccessors = "immediate"


class BaselineTask(CamelModel):
    start: date
    end: date


class BaselineRelease(CamelModel):
    planned_end: date
    buffer_days: int = 0


class Baseline(CamelModel):
    """Snapshot of the plan used for buffer consumption and late detection (BUF-5, SET-3)."""

    saved_at: datetime
    planned_end: date
    chain_days: int
    buffer_days: int = 0  # buffer is sized once, at baseline time (CCPM)
    tasks: dict[str, BaselineTask] = Field(default_factory=dict)
    releases: dict[str, BaselineRelease] = Field(default_factory=dict)  # by release id (BUF-8)


class Release(CamelModel):
    """A delivery point with its own schedule buffer (BUF-8, Critical Chain "multi-release").

    Every leaf task belongs to the earliest release whose milestone it feeds; tasks feeding no
    release milestone belong to the last release. The buffer of a release is sized from the
    chain of ITS OWN tasks only, so earlier releases are never buffered twice.
    """

    id: str
    name: str = Field(min_length=1, max_length=120)
    milestone_task_id: str
    days: int | None = Field(default=None, ge=0, le=3650)  # override the computed buffer size


class Project(CamelModel):
    id: str
    name: str = Field(min_length=1, max_length=200)
    start_date: date
    holidays: list[date] = Field(default_factory=list)
    working_days: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5])
    tasks: list[Task] = Field(default_factory=list)
    dependencies: list[Dependency] = Field(default_factory=list)
    assignments: list[Assignment] = Field(default_factory=list)
    buffer: BufferSettings = Field(default_factory=BufferSettings)
    rules: Rules = Field(default_factory=Rules)
    baseline: Baseline | None = None
    releases: list[Release] = Field(default_factory=list)
    chain_templates: list[ChainStep] | None = None  # last-used rows of the chain dialog
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    def task_by_id(self) -> dict[str, Task]:
        return {t.id: t for t in self.tasks}


class IndexEntry(CamelModel):
    id: str
    name: str
    updated_at: datetime
