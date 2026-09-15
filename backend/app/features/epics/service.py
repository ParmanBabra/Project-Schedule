from __future__ import annotations

from app.core.errors import NotFound, ValidationFailed
from app.core.ids import new_id
from app.core.models import ChecklistItem, Dependency, EpicInfo, Project, Task
from app.features.projects.repository import ProjectRepository
from app.features.projects.schemas import ProjectOut
from app.features.projects.service import validate_and_save
from app.features.scheduling.engine import ancestors, build_tree

from .schemas import EpicBulkCreate, EpicCreate, EpicMembersBody, EpicUpdate

EPIC_COLORS = ["#6a4fd8", "#e0457b", "#1f9e89", "#f28c28", "#2e86de", "#a1519c"]


def _task(project: Project, task_id: str) -> Task:
    for t in project.tasks:
        if t.id == task_id:
            return t
    raise NotFound(f"task {task_id} not found")


def _epic(project: Project, task_id: str) -> Task:
    t = _task(project, task_id)
    if t.epic is None:
        raise ValidationFailed(f"งาน {t.name!r} ไม่ใช่ Epic")
    return t


def _new_id(project: Project, prefix: str) -> str:
    ids = {t.id for t in project.tasks} | {d.id for d in project.dependencies}
    tid = new_id(prefix)
    while tid in ids:
        tid = new_id(prefix)
    return tid


def _siblings(project: Project, parent_id: str | None) -> list[Task]:
    return sorted(
        (t for t in project.tasks if t.parent_id == parent_id), key=lambda t: (t.order, t.id)
    )


def _renumber(project: Project, parent_id: str | None) -> None:
    for n, t in enumerate(_siblings(project, parent_id), start=1):
        t.order = n


def _next_color(project: Project) -> str:
    used = [t.epic.color for t in project.tasks if t.epic is not None]
    for c in EPIC_COLORS:
        if c not in used:
            return c
    return EPIC_COLORS[len(used) % len(EPIC_COLORS)]


def _move_into(project: Project, epic: Task, task_ids: list[str]) -> None:
    """Re-parent existing tasks under the Epic, keeping their relative order."""
    _, by_id = build_tree(project.tasks)
    moving = [_task(project, tid) for tid in task_ids]
    for t in moving:
        if (
            t.id == epic.id
            or epic.id in ancestors(t.id, by_id)
            and t.id in ancestors(epic.id, by_id)
        ):
            raise ValidationFailed("ย้ายงานเข้าไปในตัวเองไม่ได้")
        if t.id in ancestors(epic.id, by_id):
            raise ValidationFailed(f"{t.name!r} เป็นกลุ่มแม่ของ Epic นี้ ย้ายเข้าไม่ได้")
    old_parents = {t.parent_id for t in moving}
    base = len(_siblings(project, epic.id))
    for n, t in enumerate(sorted(moving, key=lambda t: (t.order, t.id)), start=1):
        t.parent_id = epic.id
        t.order = base + n
    for p in old_parents:
        _renumber(project, p)


def _create_one(project: Project, body: EpicCreate, color: str | None = None) -> Task:
    parent_id = body.parent_id
    if parent_id is not None:
        _task(project, parent_id)
    epic = Task(
        id=_new_id(project, "t"),
        name=body.name.strip(),
        duration=0,
        parent_id=parent_id,
        epic=EpicInfo(
            color=color or body.color,
            description=body.description.strip(),
            owner_resource_id=body.owner_resource_id,
        ),
    )
    siblings = _siblings(project, parent_id)
    if body.position == "after" and body.after_task_id:
        anchor = _task(project, body.after_task_id)
        if anchor.parent_id != parent_id:
            raise ValidationFailed("afterTaskId ต้องอยู่ระดับเดียวกับ Epic")
        epic.order = anchor.order + 1
        for t in siblings:
            if t.order >= epic.order:
                t.order += 1
    else:
        epic.order = len(siblings) + 1
    project.tasks.append(epic)

    prev: Task | None = None
    for i, spec in enumerate(body.tasks, start=1):
        t = Task(
            id=_new_id(project, "t"),
            name=spec.name.strip(),
            duration=spec.duration,
            is_milestone=spec.duration == 0,
            parent_id=epic.id,
            order=i,
            checklist=[
                ChecklistItem(id=_new_id(project, "c"), text=x.strip())
                for x in spec.checklist
                if x.strip()
            ],
        )
        project.tasks.append(t)
        if body.sequential and prev is not None:
            project.dependencies.append(
                Dependency(id=_new_id(project, "d"), **{"from": prev.id}, to=t.id, type="FS")
            )
        prev = t
    if body.existing_task_ids:
        _move_into(project, epic, body.existing_task_ids)
    _renumber(project, parent_id)
    return epic


def create_epic(repo: ProjectRepository, project_id: str, body: EpicCreate) -> ProjectOut:
    project = repo.get(project_id)
    color = body.color if "color" in body.model_fields_set else _next_color(project)
    _create_one(project, body, color)
    return validate_and_save(repo, project)


def create_epics(repo: ProjectRepository, project_id: str, body: EpicBulkCreate) -> ProjectOut:
    """Paste-from-Excel: several Epics at once. A name matching an existing Epic adds to it."""
    project = repo.get(project_id)
    existing = {t.name.strip().casefold(): t for t in project.tasks if t.epic is not None}
    created: list[Task] = []
    for spec in body.epics:
        hit = existing.get(spec.name.strip().casefold())
        if hit is not None:
            merged = spec.model_copy(update={"parent_id": hit.parent_id})
            # add the tasks under the existing Epic
            tmp = EpicCreate(**merged.model_dump(by_alias=False))
            base = len(_siblings(project, hit.id))
            prev: Task | None = None
            for i, ts in enumerate(tmp.tasks, start=1):
                t = Task(
                    id=_new_id(project, "t"),
                    name=ts.name.strip(),
                    duration=ts.duration,
                    is_milestone=ts.duration == 0,
                    parent_id=hit.id,
                    order=base + i,
                    checklist=[
                        ChecklistItem(id=_new_id(project, "c"), text=x.strip())
                        for x in ts.checklist
                        if x.strip()
                    ],
                )
                project.tasks.append(t)
                if tmp.sequential and prev is not None:
                    project.dependencies.append(
                        Dependency(
                            id=_new_id(project, "d"), **{"from": prev.id}, to=t.id, type="FS"
                        )
                    )
                prev = t
            created.append(hit)
            continue
        color = spec.color if "color" in spec.model_fields_set else _next_color(project)
        epic = _create_one(project, spec, color)
        existing[epic.name.casefold()] = epic
        created.append(epic)
    if body.link_epics:
        for a, b in zip(created, created[1:], strict=False):
            if a.id != b.id:
                project.dependencies.append(
                    Dependency(id=_new_id(project, "d"), **{"from": a.id}, to=b.id, type="FS")
                )
    return validate_and_save(repo, project)


def update_epic(
    repo: ProjectRepository, project_id: str, task_id: str, body: EpicUpdate
) -> ProjectOut:
    project = repo.get(project_id)
    epic = _epic(project, task_id)
    info = epic.epic
    assert info is not None
    if body.name is not None:
        epic.name = body.name.strip()
    if body.color is not None:
        info.color = body.color
    if body.description is not None:
        info.description = body.description.strip()
    if body.owner_resource_id is not None:
        info.owner_resource_id = body.owner_resource_id
    if body.clear_owner:
        info.owner_resource_id = None
    return validate_and_save(repo, project)


def convert_group(repo: ProjectRepository, project_id: str, task_id: str) -> ProjectOut:
    """Promote a plain task/group to an Epic (keeps everything else)."""
    project = repo.get(project_id)
    t = _task(project, task_id)
    if t.epic is None:
        t.epic = EpicInfo(color=_next_color(project))
    return validate_and_save(repo, project)


def add_members(
    repo: ProjectRepository, project_id: str, task_id: str, body: EpicMembersBody
) -> ProjectOut:
    project = repo.get(project_id)
    epic = _epic(project, task_id)
    _move_into(project, epic, body.task_ids)
    return validate_and_save(repo, project)
