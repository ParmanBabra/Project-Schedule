from __future__ import annotations

from app.core.errors import NotFound, ValidationFailed
from app.core.ids import new_id
from app.core.models import Project, Task
from app.features.projects.repository import ProjectRepository
from app.features.projects.schemas import ProjectOut
from app.features.projects.service import validate_and_save
from app.features.scheduling.engine import ancestors, build_tree

from .schemas import DeleteMode, GroupBody, MoveBody, ReorderBody, TaskCreate, TaskUpdate


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
    for key in body.model_fields_set - {"clear_constraint", "clear_estimate"}:
        value = getattr(body, key)
        if value is not None:
            setattr(task, key, value)
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
