from __future__ import annotations

from datetime import date

from app.core.models import BufferMethod, CamelModel


class TaskSchedule(CamelModel):
    id: str
    wbs: str
    is_summary: bool
    is_milestone: bool
    duration: int
    start: date
    end: date
    early_start: date
    early_finish: date
    late_start: date
    late_finish: date
    es: int
    ef: int
    ls: int
    lf: int
    total_float: int
    free_float: int
    is_critical: bool
    is_near_critical: bool
    progress: int
    depth: int


class BufferResult(CamelModel):
    method: BufferMethod
    chain_days: int
    days: int
    end: date | None
    management_reserve_days: int
    management_reserve_end: date | None
    percent_used: int | None = None
    note: str | None = None
    consumed_percent: int | None = None
    status: str | None = None


class ScheduleSummary(CamelModel):
    task_count: int
    critical_count: int
    near_critical_count: int
    progress: int
    chain_days: int
    planned_end: date | None
    committed_end: date | None


class Schedule(CamelModel):
    tasks: dict[str, TaskSchedule]
    critical_path: list[str]
    summary: ScheduleSummary
    buffer: BufferResult
