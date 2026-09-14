from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from app.core.errors import Conflict, ValidationFailed
from app.core.ids import new_id
from app.core.models import Project
from app.features.projects.repository import ProjectRepository
from app.features.scheduling.engine import compute_schedule

from .models import (
    RESOURCE_COLORS,
    Overallocation,
    Resource,
    ResourceCreate,
    ResourceOut,
    ResourceUpdate,
    ResourceWorkload,
    WorkloadDay,
    WorkloadItem,
    WorkloadResponse,
)
from .repository import ResourceRepository

# ------------------------------------------------------------------------ CRUD


def _usage(projects: list[Project]) -> dict[str, tuple[int, int]]:
    """resource id -> (assignment count, project count)"""
    counts: dict[str, int] = defaultdict(int)
    projs: dict[str, set[str]] = defaultdict(set)
    for p in projects:
        for a in p.assignments:
            counts[a.resource_id] += 1
            projs[a.resource_id].add(p.id)
    return {rid: (counts[rid], len(projs[rid])) for rid in counts}


def list_resources(repo: ResourceRepository, projects: ProjectRepository) -> list[ResourceOut]:
    usage = _usage(projects.all())
    out = []
    for r in repo.all():
        a, p = usage.get(r.id, (0, 0))
        out.append(ResourceOut(**r.model_dump(by_alias=False), assignment_count=a, project_count=p))
    return out


def create_resource(repo: ResourceRepository, body: ResourceCreate) -> Resource:
    with repo.locked():
        resources = repo.all()
        ids = {r.id for r in resources}
        rid = new_id("r")
        while rid in ids:
            rid = new_id("r")
        color = body.color or RESOURCE_COLORS[len(resources) % len(RESOURCE_COLORS)]
        res = Resource(
            id=rid,
            name=body.name.strip(),
            type=body.type,
            capacity_per_day=body.capacity_per_day,
            color=color,
            days_off=sorted(set(body.days_off)),
        )
        resources.append(res)
        repo.save_all(resources)
        return res


def update_resource(repo: ResourceRepository, resource_id: str, body: ResourceUpdate) -> Resource:
    with repo.locked():
        resources = repo.all()
        target = next((r for r in resources if r.id == resource_id), None)
        if target is None:
            repo.get(resource_id)  # raises NotFound
        assert target is not None
        for key in body.model_fields_set:
            value = getattr(body, key)
            if value is None:
                continue
            if key == "days_off":
                value = sorted(set(value))
            if key == "name":
                value = value.strip()
            setattr(target, key, value)
        repo.save_all(resources)
        return target


def delete_resource(
    repo: ResourceRepository, projects: ProjectRepository, resource_id: str, force: bool
) -> None:
    with repo.locked():
        resources = repo.all()
        if not any(r.id == resource_id for r in resources):
            repo.get(resource_id)
        used = [
            p for p in projects.all() if any(a.resource_id == resource_id for a in p.assignments)
        ]
        if used and not force:
            raise Conflict(
                "resource is assigned in projects",
                details={"projects": [{"id": p.id, "name": p.name} for p in used]},
            )
        for p in used:
            p.assignments = [a for a in p.assignments if a.resource_id != resource_id]
            projects.save(p)
        repo.save_all([r for r in resources if r.id != resource_id])


# -------------------------------------------------------------------- workload


def _daterange(a: date, b: date):
    d = a
    while d <= b:
        yield d
        d += timedelta(days=1)


def workload(
    repo: ResourceRepository,
    projects: ProjectRepository,
    start: date,
    end: date,
    project_id: str | None = None,
    resource_ids: list[str] | None = None,
) -> WorkloadResponse:
    """Per-day load (% of capacity) for every resource across ALL projects (RES-6).

    A task contributes its assignment units on every working day it spans (leaf tasks
    only). `threshold` (SET-4) comes from the given project, else 100.
    """
    if end < start:
        raise ValidationFailed("'to' must not be before 'from'")
    if (end - start).days > 400:
        raise ValidationFailed("range too long (max 400 days)")

    resources = [r for r in repo.all() if not resource_ids or r.id in resource_ids]
    by_res: dict[str, dict[date, list[WorkloadItem]]] = {r.id: defaultdict(list) for r in resources}
    threshold = 100
    all_projects = projects.all()
    for p in all_projects:
        if project_id and p.id == project_id:
            threshold = p.rules.overallocation_threshold
        if not p.assignments:
            continue
        schedule = compute_schedule(p)
        working = set(p.working_days)
        holidays = set(p.holidays)
        names = {t.id: t.name for t in p.tasks}
        for a in p.assignments:
            if a.resource_id not in by_res:
                continue
            s = schedule.tasks.get(a.task_id)
            if s is None or s.is_summary or s.is_milestone:
                continue
            lo, hi = max(s.start, start), min(s.end, end)
            for d in _daterange(lo, hi):
                if d.isoweekday() not in working or d in holidays:
                    continue
                by_res[a.resource_id][d].append(
                    WorkloadItem(
                        project_id=p.id,
                        project_name=p.name,
                        task_id=a.task_id,
                        task_name=names.get(a.task_id, a.task_id),
                        units=a.units,
                    )
                )

    out: list[ResourceWorkload] = []
    overs: list[Overallocation] = []
    for r in resources:
        days: list[WorkloadDay] = []
        peak = 0
        over_days = 0
        offs = set(r.days_off)
        for d in _daterange(start, end):
            items = by_res[r.id].get(d, [])
            load = sum(i.units for i in items)
            off = d in offs
            cap = 0 if off else r.capacity_per_day
            over = load > 0 and (off or load > cap * threshold / 100)
            peak = max(peak, load)
            if over:
                over_days += 1
                overs.append(
                    Overallocation(
                        resource_id=r.id,
                        resource_name=r.name,
                        date=d,
                        load=load,
                        capacity=cap,
                        items=items,
                    )
                )
            days.append(
                WorkloadDay(date=d, load=load, capacity=cap, over=over, off=off, items=items)
            )
        out.append(ResourceWorkload(resource=r, days=days, peak=peak, over_days=over_days))
    overs.sort(key=lambda o: (o.date, o.resource_name))
    return WorkloadResponse(
        **{"from": start}, to=end, threshold=threshold, resources=out, overallocations=overs
    )
