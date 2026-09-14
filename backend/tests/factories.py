"""Small builders for tests. Project start is Monday 2026-09-14, Mon–Fri working."""

from __future__ import annotations

from datetime import date

from app.core.models import Dependency, Project, Task

START = date(2026, 9, 14)


def task(
    id: str,
    dur: int = 1,
    *,
    name: str | None = None,
    parent: str | None = None,
    order: int = 0,
    progress: int = 0,
    milestone: bool = False,
    **extra,
) -> Task:
    return Task(
        id=id,
        name=name or id,
        duration=dur,
        parent_id=parent,
        order=order,
        progress=progress,
        is_milestone=milestone,
        **extra,
    )


def dep(a: str, b: str, type: str = "FS", lag: int = 0, id: str | None = None) -> Dependency:
    return Dependency(id=id or f"d_{a}_{b}", **{"from": a}, to=b, type=type, lag=lag)


def project(tasks: list[Task], deps: list[Dependency] | None = None, **extra) -> Project:
    return Project(
        id="prj_test", name="test", start_date=START, tasks=tasks, dependencies=deps or [], **extra
    )


def sample_project() -> Project:
    """The example used across the docs and mockups (critical chain 17 working days)."""
    return project(
        [
            task("t1", 3, name="รวบรวมความต้องการ", order=1, progress=100),
            task("t2", 5, name="ออกแบบระบบ", order=2, progress=40),
            task("t3", 4, name="ออกแบบ UI", order=3, progress=25),
            task("t4", 6, name="พัฒนา Backend", order=4),
            task("t5", 5, name="พัฒนา Frontend", order=5),
            task("t6", 3, name="ทดสอบระบบ", order=6),
        ],
        [
            dep("t1", "t2"),
            dep("t1", "t3"),
            dep("t2", "t4"),
            dep("t3", "t5"),
            dep("t4", "t6"),
            dep("t5", "t6"),
        ],
    )
