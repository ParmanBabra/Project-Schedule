from __future__ import annotations

import csv
import io

from app.core.errors import ValidationFailed
from app.core.ids import new_id
from app.core.models import Project, utcnow
from app.features.projects.repository import ProjectRepository
from app.features.projects.schemas import ProjectOut
from app.features.projects.service import validate_and_save
from app.features.resources.models import RESOURCE_COLORS, Resource
from app.features.resources.repository import ResourceRepository
from app.features.scheduling.engine import compute_schedule

from .schemas import EXPORT_FORMAT, ExportedProject, ImportBody, ImportResult, ProjectExport


def export_project(
    projects: ProjectRepository, resources: ResourceRepository, project_id: str
) -> ProjectExport:
    project = projects.get(project_id)
    used = {a.resource_id for a in project.assignments}
    return ProjectExport(
        exported_at=utcnow(),
        project=ExportedProject(**project.model_dump(by_alias=False)),
        resources=[r for r in resources.all() if r.id in used],
    )


def _norm(name: str) -> str:
    return " ".join(name.split()).casefold()


def _validate_graph(src: ExportedProject) -> None:
    task_ids = {t.id for t in src.tasks}
    if len(task_ids) != len(src.tasks):
        raise ValidationFailed("รหัสงานในไฟล์ซ้ำกัน")
    for d in src.dependencies:
        if d.from_ not in task_ids or d.to not in task_ids:
            raise ValidationFailed(f"ความสัมพันธ์ {d.id} อ้างถึงงานที่ไม่มีในไฟล์")
    for t in src.tasks:
        if t.parent_id is not None and t.parent_id not in task_ids:
            raise ValidationFailed(f"งาน {t.name!r} อ้างถึงกลุ่มที่ไม่มีในไฟล์")
    for a in src.assignments:
        if a.task_id not in task_ids:
            raise ValidationFailed(f"การมอบหมาย {a.id} อ้างถึงงานที่ไม่มีในไฟล์")


def _map_resources(
    resources: ResourceRepository, body: ImportBody
) -> tuple[dict[str, str], list[str], list[str]]:
    """Resource id in the file -> id in this data folder. Matches by name, creates the rest."""
    exported_by_id = {r.id: r for r in body.resources}
    created: list[str] = []
    matched: list[str] = []
    id_map: dict[str, str] = {}
    with resources.locked():
        existing = resources.all()
        by_name = {_norm(r.name): r for r in existing}
        ids = {r.id for r in existing}
        for a in body.project.assignments:
            if a.resource_id in id_map:
                continue
            exp = exported_by_id.get(a.resource_id)
            if exp is None:
                raise ValidationFailed(f"การมอบหมาย {a.id} อ้างถึงทรัพยากรที่ไม่มีในไฟล์")
            hit = by_name.get(_norm(exp.name))
            if hit is not None:
                id_map[a.resource_id] = hit.id
                if hit.name not in matched:
                    matched.append(hit.name)
                continue
            rid = new_id("r")
            while rid in ids:
                rid = new_id("r")
            ids.add(rid)
            new = Resource(
                id=rid,
                name=exp.name.strip(),
                type=exp.type,
                capacity_per_day=exp.capacity_per_day,
                color=exp.color or RESOURCE_COLORS[len(existing) % len(RESOURCE_COLORS)],
                days_off=exp.days_off,
            )
            existing.append(new)
            by_name[_norm(new.name)] = new
            id_map[a.resource_id] = rid
            created.append(new.name)
        if created:
            resources.save_all(existing)
    return id_map, created, matched


def import_project(
    projects: ProjectRepository, resources: ResourceRepository, body: ImportBody
) -> tuple[ProjectOut, ImportResult]:
    if body.format != EXPORT_FORMAT:
        raise ValidationFailed(f"ไฟล์นี้ไม่ใช่ไฟล์โปรเจกต์ของแผนงาน (format={body.format!r})")
    src = body.project
    _validate_graph(src)
    id_map, created, matched = _map_resources(resources, body)

    pid = new_id("prj")
    while projects.exists(pid):
        pid = new_id("prj")
    assignments = [
        a.model_copy(update={"resource_id": id_map[a.resource_id]}) for a in src.assignments
    ]
    project = Project(
        id=pid,
        name=body.name or src.name,
        start_date=src.start_date,
        holidays=sorted(set(src.holidays)),
        working_days=sorted(set(src.working_days)),
        tasks=src.tasks,
        dependencies=src.dependencies,
        assignments=assignments,
        buffer=src.buffer,
        rules=src.rules,
        baseline=src.baseline,
    )
    out = validate_and_save(projects, project)
    result = ImportResult(project_id=pid, created_resources=created, matched_resources=matched)
    return out, result


CSV_HEADER = [
    "WBS", "ชื่องาน", "ประเภท", "ระยะเวลา (วัน)", "เริ่ม", "สิ้นสุด",
    "เริ่มช้าสุด", "เสร็จช้าสุด", "Total float", "Free float", "Critical",
    "ความคืบหน้า %", "สถานะ", "ผู้ทำ", "งานก่อนหน้า",
]  # fmt: skip


def export_csv(projects: ProjectRepository, resources: ResourceRepository, project_id: str) -> str:
    """Tasks in outline order with computed dates and float (IO-3). UTF-8 with BOM for Excel."""
    project = projects.get(project_id)
    schedule = compute_schedule(project)
    names = {t.id: t.name for t in project.tasks}
    res_names = {r.id: r.name for r in resources.all()}
    who: dict[str, list[str]] = {}
    for a in project.assignments:
        who.setdefault(a.task_id, []).append(f"{res_names.get(a.resource_id, '?')} {a.units}%")
    preds: dict[str, list[str]] = {}
    for d in project.dependencies:
        lag = f" {d.lag:+d} วัน" if d.lag else ""
        preds.setdefault(d.to, []).append(f"{names.get(d.from_, '?')} ({d.type}{lag})")

    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n")
    w.writerow(CSV_HEADER)
    ordered = sorted(schedule.tasks.values(), key=lambda s: [int(x) for x in s.wbs.split(".")])
    for s in ordered:
        kind = "กลุ่ม" if s.is_summary else ("milestone" if s.is_milestone else "งาน")
        w.writerow(
            [
                s.wbs,
                names.get(s.id, ""),
                kind,
                s.duration,
                s.start.isoformat(),
                s.end.isoformat(),
                s.late_start.isoformat(),
                s.late_finish.isoformat(),
                s.total_float,
                s.free_float,
                "ใช่" if s.is_critical else "",
                s.progress,
                s.health,
                "; ".join(who.get(s.id, [])),
                "; ".join(preds.get(s.id, [])),
            ]  # fmt: skip
        )
    b = schedule.buffer
    w.writerow([])
    w.writerow(
        [
            "สำรองเวลาโครงการ",
            b.method,
            b.days,
            b.start.isoformat() if b.start else "",
            b.end.isoformat() if b.end else "",
        ]  # fmt: skip
    )
    return "﻿" + buf.getvalue()
