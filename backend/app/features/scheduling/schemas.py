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
    health: str = "not_started"  # done | late | on_track | not_started
    expected_progress: int = 0


class BufferResult(CamelModel):
    method: BufferMethod
    chain_days: int
    days: int
    start: date | None = None  # last planned day before the buffer (baseline end when frozen)
    end: date | None
    management_reserve_days: int
    management_reserve_end: date | None
    percent_used: int | None = None
    note: str | None = None
    consumed_percent: int | None = None
    status: str | None = None  # green | yellow | red
    chain_progress: int = 0
    consumed_days: int | None = None
    ahead_days: int = 0  # working days the current plan finishes before the baseline end
    padding_warning: bool = False  # BUF-7: estimates look padded while using ccpm
    padding_note: str | None = None


class ScheduleSummary(CamelModel):
    task_count: int
    critical_count: int
    near_critical_count: int
    progress: int
    chain_days: int
    planned_end: date | None
    committed_end: date | None
    late_count: int = 0
    baseline_planned_end: date | None = None


class Schedule(CamelModel):
    tasks: dict[str, TaskSchedule]
    critical_path: list[str]
    summary: ScheduleSummary
    buffer: BufferResult
