from __future__ import annotations

from pydantic import Field

from app.core.models import CamelModel, DependencyType


class DependencyCreate(CamelModel):
    from_: str = Field(alias="from")
    to: str
    type: DependencyType | None = None  # default from project.rules.defaultDependency
    lag: int | None = Field(default=None, ge=-3650, le=3650)


class DependencyUpdate(CamelModel):
    type: DependencyType | None = None
    lag: int | None = Field(default=None, ge=-3650, le=3650)
