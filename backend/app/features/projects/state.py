"""Whole-state replace used by the frontend undo/redo (docs/features.md HIS-1).

The client keeps snapshots of the project it received; undo sends one back. Only
user-editable fields are accepted – ids, timestamps and the computed schedule are not.
"""

from __future__ import annotations

from datetime import date

from pydantic import Field

from app.core.models import Assignment, BufferSettings, CamelModel, Dependency, Rules, Task


class ProjectState(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    start_date: date
    holidays: list[date] = Field(default_factory=list)
    working_days: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5])
    tasks: list[Task] = Field(default_factory=list)
    dependencies: list[Dependency] = Field(default_factory=list)
    assignments: list[Assignment] = Field(default_factory=list)
    buffer: BufferSettings = Field(default_factory=BufferSettings)
    rules: Rules = Field(default_factory=Rules)
