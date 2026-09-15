from __future__ import annotations

from app.core.errors import NotFound, ValidationFailed
from app.core.ids import new_id
from app.core.models import Assignment, ChecklistItem, Dependency, Project, Task
from app.features.projects.repository import ProjectRepository
from app.features.projects.schemas import ProjectOut
from app.features.projects.service import apply_checklists, validate_and_save
from app.features.scheduling.engine import ancestors, build_tree, compute_schedule

from .schemas import (
    ChainBody,
    ChecklistItemIn,
    DeleteMode,
    GroupBody,
    MoveBody,
    ReorderBody,
    TaskCreate,
    TaskUpdate,
)


def _task(project: Project, task_id: str) -> Task:
    for t in project.tasks:
        if t.id == task_id:
            return t
    raise NotFound(f"task {task_id} not found")


def _siblings(project: Project, parent_id: str | None) -> list[Task]:
    return sorted(
        (t for t in project.tasks if t.parent_id == parent_id), key=lambda t: (t.order, t.id)
    )


def _renumber(project: Project, parent_id: str | None) -> None:
    for n, t in enumerate(_siblings(project, parent_id), start=1):
        t.order = n


def _new_task_id(project: Project) -> str:
    ids = {t.id for t in project.tasks}
    tid = new_id("t")
    while tid in ids:
        tid = new_id("t")
    return tid


def add_task(repo: ProjectRepository, project_id: str, body: TaskCreate) -> ProjectOut:
    project = repo.get(project_id)
    if body.parent_id is not None:
        _task(project, body.parent_id)
    task = Task(
        id=_new_task_id(project),
        name=body.name,
        duration=0 if body.is_milestone else body.duration,
        progress=body.progress,
        is_milestone=body.is_milestone,
        parent_id=body.parent_id,
        constraint=body.constraint,
        color=body.color,
        estimate=body.estimate,
    )
    siblings = _siblings(project, body.parent_id)
    if body.after_id is not None:
        anchor = _task(project, body.after_id)
        if anchor.parent_id != body.parent_id:
            raise ValidationFailed("afterId must be a sibling under the same parent")
        task.order = anchor.order + 1
        for s in siblings:
            if s.order > anchor.order:
                s.order += 1
    else:
        task.order = (siblings[-1].order + 1) if siblings else 1
    project.tasks.append(task)
    _renumber(project, body.parent_id)
    return validate_and_save(repo, project)


def update_task(
    repo: ProjectRepository, project_id: str, task_id: str, body: TaskUpdate
) -> ProjectOut:
    project = repo.get(project_id)
    task = _task(project, task_id)
    for key in body.model_fields_set - {
        "clear_constraint",
        "clear_estimate",
        "clear_epic",
        "checklist",
    }:
        value = getattr(body, key)
        if value is not None:
            setattr(task, key, value)
    if body.checklist is not None:
        _apply_checklist(project, task, body.checklist)
    if body.clear_epic:
        task.epic = None
    if body.clear_constraint:
        task.constraint = None
    if body.clear_estimate:
        task.estimate = None
    if task.is_milestone:
        task.duration = 0
    return validate_and_save(repo, project)


def delete_task(
    repo: ProjectRepository, project_id: str, task_id: str, mode: DeleteMode = "lift"
) -> ProjectOut:
    project = repo.get(project_id)
    task = _task(project, task_id)
    children, _ = build_tree(project.tasks)
    removed = {task_id}
    if mode == "cascade":
        stack = list(children.get(task_id, []))
        while stack:
            cur = stack.pop()
            removed.add(cur)
            stack.extend(children.get(cur, []))
    else:
        for t in project.tasks:
            if t.parent_id == task_id:
                t.parent_id = task.parent_id
    project.tasks = [t for t in project.tasks if t.id not in removed]
    project.dependencies = [
        d for d in project.dependencies if d.from_ not in removed and d.to not in removed
    ]
    project.assignments = [a for a in project.assignments if a.task_id not in removed]
    _renumber(project, task.parent_id)
    return validate_and_save(repo, project)


def reorder(repo: ProjectRepository, project_id: str, body: ReorderBody) -> ProjectOut:
    project = repo.get(project_id)
    if body.parent_id is not None:
        _task(project, body.parent_id)
    siblings = {t.id for t in _siblings(project, body.parent_id)}
    if set(body.ids) != siblings or len(body.ids) != len(siblings):
        raise ValidationFailed("ids must list every sibling under parentId exactly once")
    by_id = project.task_by_id()
    for n, tid in enumerate(body.ids, start=1):
        by_id[tid].order = n
    return validate_and_save(repo, project)


def group(repo: ProjectRepository, project_id: str, body: GroupBody) -> ProjectOut:
    project = repo.get(project_id)
    selected = [_task(project, tid) for tid in body.task_ids]
    parents = {t.parent_id for t in selected}
    if len(parents) != 1:
        raise ValidationFailed("tasks to group must share the same parent")
    parent_id = parents.pop()
    summary = Task(id=_new_task_id(project), name=body.name, duration=0, parent_id=parent_id)
    summary.order = min(t.order for t in selected)
    for t in project.tasks:
        if t.parent_id == parent_id and t.order >= summary.order and t not in selected:
            t.order += 1
    project.tasks.append(summary)
    for n, t in enumerate(sorted(selected, key=lambda t: (t.order, t.id)), start=1):
        t.parent_id = summary.id
        t.order = n
    _renumber(project, parent_id)
    return validate_and_save(repo, project)


def move(repo: ProjectRepository, project_id: str, task_id: str, body: MoveBody) -> ProjectOut:
    project = repo.get(project_id)
    task = _task(project, task_id)
    _, by_id = build_tree(project.tasks)
    if body.parent_id is not None:
        _task(project, body.parent_id)
        if body.parent_id == task_id or task_id in ancestors(body.parent_id, by_id):
            raise ValidationFailed("cannot move a task under its own descendant")
    old_parent = task.parent_id
    task.parent_id = body.parent_id
    siblings = [t for t in _siblings(project, body.parent_id) if t.id != task_id]
    pos = body.order if body.order is not None else len(siblings) + 1
    pos = max(1, min(pos, len(siblings) + 1))
    siblings.insert(pos - 1, task)
    for n, t in enumerate(siblings, start=1):
        t.order = n
    if old_parent != body.parent_id:
        _renumber(project, old_parent)
    return validate_and_save(repo, project)


# ------------------------------------------------------------------ checklist (TSK-8)


def _apply_checklist(project: Project, task: Task, items: list[ChecklistItemIn]) -> None:
    used = {c.id for t in project.tasks for c in t.checklist if t.id != task.id}
    out: list[ChecklistItem] = []
    for it in items:
        cid = it.id
        if cid is None or cid in used or any(c.id == cid for c in out):
            cid = new_id("c")
            while cid in used or any(c.id == cid for c in out):
                cid = new_id("c")
        out.append(ChecklistItem(id=cid, text=it.text.strip(), done=it.done))
    task.checklist = out


# ------------------------------------------------------------------ chain (TSK-9)


def _new_dep_id(project: Project) -> str:
    ids = {d.id for d in project.dependencies}
    did = new_id("d")
    while did in ids:
        did = new_id("d")
    return did


def create_chain(
    repo: ProjectRepository, project_id: str, task_id: str, body: ChainBody, dry_run: bool = False
) -> ProjectOut:
    """Create the enabled steps after `task_id`, linked FS in order.

    A step marked `parallel` starts together with the previous step (SS 0) and shares its
    predecessors; the step after a parallel block waits for every task in the block (FS).
    With `group_name` the source task and the new tasks become children of a new group.
    """
    project = repo.get(project_id)
    source = _task(project, task_id)
    if any(t.parent_id == task_id for t in project.tasks):
        raise ValidationFailed("สร้างงานต่อจากกลุ่มงานไม่ได้ เลือกงานลูกแทน")
    steps = [s for s in body.steps if s.enabled]
    if not steps:
        raise ValidationFailed("เลือกอย่างน้อย 1 ขั้นตอน")

    parent_id = source.parent_id
    if body.group_name:
        group_task = Task(
            id=_new_task_id(project), name=body.group_name, duration=0, parent_id=parent_id
        )
        group_task.order = source.order
        for t in project.tasks:
            if t.parent_id == parent_id and t.order >= source.order:
                t.order += 1
        project.tasks.append(group_task)
        source.parent_id = group_task.id
        source.order = 1
        parent_id = group_task.id
        _renumber(project, group_task.parent_id)

    # make room right after the source among its (possibly new) siblings
    for t in project.tasks:
        if t.parent_id == parent_id and t.order > source.order and t.id != source.id:
            t.order += len(steps)

    source_assignments = [a for a in project.assignments if a.task_id == source.id]
    prev_block: list[Task] = [source]  # what a sequential step waits for (FS)
    cur_block: list[Task] = []  # steps running side by side; the next sequential step waits for all
    for i, step in enumerate(steps):
        name = f"{source.name} – {step.name}" if body.prefix_with_source else step.name
        task = Task(
            id=_new_task_id(project),
            name=name,
            duration=step.duration,
            is_milestone=step.duration == 0,
            parent_id=parent_id,
        )
        task.order = source.order + i + 1
        project.tasks.append(task)
        if not (step.parallel and cur_block):
            if cur_block:
                prev_block = cur_block
            cur_block = []
        for p in prev_block:
            project.dependencies.append(
                Dependency(id=_new_dep_id(project), **{"from": p.id}, to=task.id, type="FS")
            )
        cur_block.append(task)
        if body.copy_assignees:
            for a in source_assignments:
                aid = new_id("a")
                while any(x.id == aid for x in project.assignments):
                    aid = new_id("a")
                project.assignments.append(
                    Assignment(id=aid, task_id=task.id, resource_id=a.resource_id, units=a.units)
                )
    _renumber(project, parent_id)
    if body.remember:
        project.chain_templates = list(body.steps)
    if dry_run:
        apply_checklists(project)
        schedule = compute_schedule(project)
        return ProjectOut(**project.model_dump(by_alias=False), schedule=schedule)
    return validate_and_save(repo, project)
