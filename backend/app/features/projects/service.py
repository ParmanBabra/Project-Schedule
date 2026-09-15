from __future__ import annotations

from app.core.errors import ValidationFailed
from app.core.ids import new_id
from app.core.models import BufferSettings, Project, Rules, Task, utcnow
from app.features.scheduling.engine import compute_schedule

from .repository import ProjectRepository
from .schemas import ProjectCreate, ProjectListItem, ProjectOut, ProjectUpdate
from .state import ProjectState


def to_out(project: Project) -> ProjectOut:
    schedule = compute_schedule(project)
    return ProjectOut(**project.model_dump(by_alias=False), schedule=schedule)


def checklist_progress(task: Task) -> int | None:
    """Progress derived from the checklist (TSK-8), or None when the task is not driven by it."""
    if not task.checklist or not task.progress_from_checklist:
        return None
    done = sum(1 for c in task.checklist if c.done)
    return int(round(done * 100 / len(task.checklist)))


def apply_checklists(project: Project) -> None:
    for t in project.tasks:
        derived = checklist_progress(t)
        if derived is not None:
            t.progress = derived


def validate_and_save(repo: ProjectRepository, project: Project) -> ProjectOut:
    """Every mutation goes through here: compute (raises on invalid graphs) then persist."""
    apply_checklists(project)
    schedule = compute_schedule(project)
    repo.save(project)
    return ProjectOut(**project.model_dump(by_alias=False), schedule=schedule)


def _check_working_days(days: list[int]) -> None:
    if not days or any(d < 1 or d > 7 for d in days):
        raise ValidationFailed("workingDays must contain ISO weekday numbers 1-7 and not be empty")


def list_projects(repo: ProjectRepository) -> list[ProjectListItem]:
    items: list[ProjectListItem] = []
    for p in repo.all():
        s = compute_schedule(p).summary
        items.append(
            ProjectListItem(
                id=p.id,
                name=p.name,
                start_date=p.start_date,
                planned_end=s.planned_end,
                committed_end=s.committed_end,
                progress=s.progress,
                task_count=s.task_count,
                critical_count=s.critical_count,
                updated_at=p.updated_at,
            )
        )
    return items


def create_project(repo: ProjectRepository, body: ProjectCreate) -> ProjectOut:
    _check_working_days(body.working_days)
    pid = new_id("prj")
    while repo.exists(pid):
        pid = new_id("prj")
    project = Project(
        id=pid,
        name=body.name,
        start_date=body.start_date,
        working_days=sorted(set(body.working_days)),
        holidays=sorted(set(body.holidays)),
        rules=body.rules or Rules(),
        buffer=body.buffer or BufferSettings(),
    )
    return validate_and_save(repo, project)


def get_project(repo: ProjectRepository, project_id: str) -> ProjectOut:
    return to_out(repo.get(project_id))


def update_project(repo: ProjectRepository, project_id: str, body: ProjectUpdate) -> ProjectOut:
    project = repo.get(project_id)
    for key in body.model_fields_set:
        value = getattr(body, key)
        if value is None:
            continue
        if key == "working_days":
            _check_working_days(value)
            value = sorted(set(value))
        elif key == "holidays":
            value = sorted(set(value))
        setattr(project, key, value)
    return validate_and_save(repo, project)


def delete_project(repo: ProjectRepository, project_id: str) -> None:
    repo.delete(project_id)


def duplicate_project(
    repo: ProjectRepository, project_id: str, name: str | None = None
) -> ProjectOut:
    src = repo.get(project_id)
    pid = new_id("prj")
    while repo.exists(pid):
        pid = new_id("prj")
    copy = src.model_copy(deep=True)
    copy.id = pid
    copy.name = name or f"{src.name} (สำเนา)"
    copy.created_at = utcnow()
    return validate_and_save(repo, copy)


def update_rules(repo: ProjectRepository, project_id: str, rules: Rules) -> ProjectOut:
    project = repo.get(project_id)
    project.rules = rules
    return validate_and_save(repo, project)


def update_buffer(repo: ProjectRepository, project_id: str, buffer: BufferSettings) -> ProjectOut:
    project = repo.get(project_id)
    project.buffer = buffer
    return validate_and_save(repo, project)


def replace_state(repo: ProjectRepository, project_id: str, state: ProjectState) -> ProjectOut:
    """Replace every editable field at once (undo/redo). Validated like any other edit."""
    project = repo.get(project_id)
    _check_working_days(state.working_days)
    project.name = state.name
    project.start_date = state.start_date
    project.holidays = sorted(set(state.holidays))
    project.working_days = sorted(set(state.working_days))
    project.tasks = state.tasks
    project.dependencies = state.dependencies
    project.chain_templates = state.chain_templates
    project.assignments = state.assignments
    project.buffer = state.buffer
    project.rules = state.rules
    return validate_and_save(repo, project)
