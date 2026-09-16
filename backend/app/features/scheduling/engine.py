"""Scheduling engine: CPM forward/backward pass, floats, critical path, WBS rollup,
and schedule buffer. Pure Python – no FastAPI, no file IO. See docs/features.md §3.4,
§3.12 and §3.13 for the rules implemented here.

Conventions
- Time is measured in working-day indexes (see `WorkCalendar`). A task with
  duration d occupies the half-open interval [ES, ES + d). Boundary k is the start
  of working day k, i.e. the end of working day k-1.
- A milestone has duration 0 and sits on a boundary; its displayed date is the
  working day that ends on that boundary (the predecessor's last day).
- Summary tasks (tasks that have children) are never scheduled directly. Their
  start/finish roll up from descendant leaves, and dependencies attached to them
  are redistributed to those leaves.
"""

from __future__ import annotations

import math
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, timedelta

from app.core.errors import CycleDetected, ValidationFailed
from app.core.models import PERT_Z, RISK_PERCENT, BufferSettings, Dependency, Project, Release, Task

from .calendar import WorkCalendar
from .schemas import (
    BufferResult,
    FeedingBuffer,
    ReleaseResult,
    Schedule,
    ScheduleSummary,
    TaskSchedule,
)

START_BASED = {"SS", "SF"}  # predecessor side is its *start*
FINISH_TO_START_SIDE = {"FS": "start", "SS": "start", "FF": "finish", "SF": "finish"}


@dataclass
class _Edge:
    src: str
    dst: str
    type: str
    lag: int
    dep_id: str | None = None


@dataclass
class _Node:
    task: Task
    is_summary: bool
    dur: int
    leaves: list[str] = field(default_factory=list)  # descendant leaf ids (summaries only)
    depth: int = 0
    es: int = 0
    ef: int = 0
    lf: int = 0
    ls: int = 0
    tf: int = 0
    ff: int = 0
    progress: int = 0
    wbs: str = ""


# --------------------------------------------------------------------------- tree


def build_tree(tasks: list[Task]) -> tuple[dict[str, list[str]], dict[str, Task]]:
    """Returns (children-by-parent, task-by-id). Validates parent references."""
    by_id = {t.id: t for t in tasks}
    children: dict[str, list[str]] = defaultdict(list)
    for t in tasks:
        if t.parent_id is not None:
            if t.parent_id not in by_id:
                raise ValidationFailed(f"task {t.id} has unknown parent {t.parent_id}")
            if t.parent_id == t.id:
                raise ValidationFailed(f"task {t.id} cannot be its own parent")
            children[t.parent_id].append(t.id)
    # detect parent cycles
    for t in tasks:
        seen = {t.id}
        cur = t.parent_id
        while cur is not None:
            if cur in seen:
                raise ValidationFailed(f"parent cycle involving task {t.id}")
            seen.add(cur)
            cur = by_id[cur].parent_id
    for kids in children.values():
        kids.sort(key=lambda i: (by_id[i].order, i))
    return children, by_id


def ancestors(task_id: str, by_id: dict[str, Task]) -> set[str]:
    out: set[str] = set()
    cur = by_id[task_id].parent_id
    while cur is not None:
        out.add(cur)
        cur = by_id[cur].parent_id
    return out


def descendant_leaves(task_id: str, children: dict[str, list[str]]) -> list[str]:
    out: list[str] = []
    stack = list(children.get(task_id, []))
    while stack:
        cur = stack.pop()
        kids = children.get(cur)
        if kids:
            stack.extend(kids)
        else:
            out.append(cur)
    return out


def wbs_numbers(children: dict[str, list[str]], roots: list[str]) -> dict[str, tuple[str, int]]:
    """Map task id -> (wbs string, depth) in outline order."""
    out: dict[str, tuple[str, int]] = {}

    def walk(ids: list[str], prefix: str, depth: int) -> None:
        for n, tid in enumerate(ids, start=1):
            code = f"{prefix}{n}"
            out[tid] = (code, depth)
            walk(children.get(tid, []), f"{code}.", depth + 1)

    walk(roots, "", 0)
    return out


# ------------------------------------------------------------------- validation


def validate_dependencies(project: Project) -> list[str]:
    """Raise on structural problems; return the topological order of node ids.

    Used by services before saving so a bad edit is rejected with a clear message.
    """
    children, by_id = build_tree(project.tasks)
    nodes, edges = _graph(project, children, by_id)
    return _topo_order(nodes, edges)


def _graph(
    project: Project, children: dict[str, list[str]], by_id: dict[str, Task]
) -> tuple[dict[str, _Node], list[_Edge]]:
    nodes: dict[str, _Node] = {}
    for t in project.tasks:
        is_summary = bool(children.get(t.id)) or t.epic is not None
        dur = 0 if (t.is_milestone or is_summary) else max(0, t.duration)
        node = _Node(task=t, is_summary=is_summary, dur=dur)
        if is_summary:
            node.leaves = descendant_leaves(t.id, children)
        nodes[t.id] = node

    edges: list[_Edge] = []
    seen_pairs: set[tuple[str, str]] = set()
    for d in project.dependencies:
        if d.from_ not in by_id or d.to not in by_id:
            raise ValidationFailed(f"dependency {d.id} references an unknown task")
        if d.from_ == d.to:
            raise ValidationFailed(f"dependency {d.id}: a task cannot depend on itself")
        pair = (d.from_, d.to)
        if pair in seen_pairs:
            raise ValidationFailed(f"duplicate dependency {d.from_} → {d.to}")
        seen_pairs.add(pair)
        if d.to in ancestors(d.from_, by_id) or d.from_ in ancestors(d.to, by_id):
            raise ValidationFailed(
                f"dependency {d.id}: {d.from_} and {d.to} are in the same WBS branch"
            )
        targets = nodes[d.to].leaves if nodes[d.to].is_summary else [d.to]
        for tgt in targets:
            edges.append(_Edge(src=d.from_, dst=tgt, type=d.type, lag=d.lag, dep_id=d.id))
    # rollup edges: every leaf feeds its summary ancestors
    for sid, node in nodes.items():
        for leaf in node.leaves:
            edges.append(_Edge(src=leaf, dst=sid, type="ROLLUP", lag=0))
    return nodes, edges


def _topo_order(nodes: dict[str, _Node], edges: list[_Edge]) -> list[str]:
    indeg = dict.fromkeys(nodes, 0)
    out: dict[str, list[str]] = defaultdict(list)
    for e in edges:
        out[e.src].append(e.dst)
        indeg[e.dst] += 1
    queue = deque(sorted(n for n, d in indeg.items() if d == 0))
    order: list[str] = []
    while queue:
        n = queue.popleft()
        order.append(n)
        for m in out[n]:
            indeg[m] -= 1
            if indeg[m] == 0:
                queue.append(m)
    if len(order) != len(nodes):
        raise CycleDetected(_find_cycle(nodes, edges))
    return order


def _find_cycle(nodes: dict[str, _Node], edges: list[_Edge]) -> list[str]:
    out: dict[str, list[str]] = defaultdict(list)
    for e in edges:
        if e.type != "ROLLUP":
            out[e.src].append(e.dst)
    color: dict[str, int] = dict.fromkeys(nodes, 0)
    stack: list[str] = []

    def dfs(n: str) -> list[str] | None:
        color[n] = 1
        stack.append(n)
        for m in out[n]:
            if color[m] == 1:
                return stack[stack.index(m) :] + [m]
            if color[m] == 0:
                found = dfs(m)
                if found:
                    return found
        stack.pop()
        color[n] = 2
        return None

    for n in nodes:
        if color[n] == 0:
            found = dfs(n)
            if found:
                return found
    return []


# ----------------------------------------------------------------------- engine


def compute_schedule(project: Project, today: date | None = None) -> Schedule:
    today = today or date.today()
    children, by_id = build_tree(project.tasks)
    if not project.working_days:
        raise ValidationFailed("project has no working days")
    cal = WorkCalendar(project.start_date, project.working_days, project.holidays)
    nodes, edges = _graph(project, children, by_id)
    order = _topo_order(nodes, edges)
    lag_calendar = project.rules.lag_unit == "calendar"

    incoming: dict[str, list[_Edge]] = defaultdict(list)
    outgoing: dict[str, list[_Edge]] = defaultdict(list)
    for e in edges:
        incoming[e.dst].append(e)
        outgoing[e.src].append(e)

    def shift(boundary: int, lag: int) -> int:
        if lag == 0 or not lag_calendar:
            return boundary + lag
        target = cal.day(boundary) + timedelta(days=lag)
        return cal.index_of(target)

    def unshift(boundary: int, lag: int) -> int:
        """Largest b such that shift(b, lag) <= boundary."""
        if lag == 0 or not lag_calendar:
            return boundary - lag
        b = cal.index_of(cal.prev_working(cal.day(boundary) - timedelta(days=lag)))
        while shift(b, lag) > boundary:
            b -= 1
        while shift(b + 1, lag) <= boundary:
            b += 1
        return b

    # ---------------------------------------------------------- forward pass
    def forward(gate: dict[str, int]) -> None:
        """ES/EF for every node in topological order. `gate` delays everything that hangs off
        a release milestone by that release's buffer (rules.release_successors = after_buffer)."""
        for nid in order:
            n = nodes[nid]
            if n.is_summary:
                leaf_nodes = [nodes[i] for i in n.leaves]
                if not leaf_nodes:  # empty Epic: sits at the project start with no length
                    n.es = n.ef = 0
                    n.dur = 0
                    continue
                n.es = min(x.es for x in leaf_nodes)
                n.ef = max(x.ef for x in leaf_nodes)
                n.dur = n.ef - n.es
                continue
            es = 0
            for e in incoming[nid]:
                if e.type == "ROLLUP":
                    continue
                p = nodes[e.src]
                g = gate.get(e.src, 0)
                if e.type == "FS":
                    bound = shift(p.ef + g, e.lag)
                elif e.type == "SS":
                    bound = shift(p.es + g, e.lag)
                elif e.type == "FF":
                    bound = shift(p.ef + g, e.lag) - n.dur
                else:  # SF
                    bound = shift(p.es + g, e.lag) - n.dur
                es = max(es, bound)
            c = n.task.constraint
            if c is not None and c.type == "SNET":
                es = max(es, cal.index_of(c.date))
            n.es = es
            n.ef = es + n.dur

    gate: dict[str, int] = {}
    forward(gate)
    releases_valid, members, feeders = release_membership(project, nodes, outgoing)
    if project.rules.release_successors == "after_buffer" and releases_valid:
        # size every release buffer from this first pass (its own chain never depends on the
        # gate), then push whatever hangs off a release milestone past that buffer and go again
        for r in releases_valid:
            chain, path = release_chain(nodes, order, incoming, set(members[r.id]))
            days, _, _ = size_buffer(project.buffer, chain, path, nodes, r.days)
            if days > 0:
                gate[r.milestone_task_id] = days
        if gate:
            forward(gate)

    project_end = max((n.ef for n in nodes.values()), default=0)
    # every task that feeds a release milestone must be done by that milestone: its own
    # deadline for the backward pass (BUF-8), instead of the end of the whole project
    deadline: dict[str, int] = {}
    for r in releases_valid:
        ms_ef = nodes[r.milestone_task_id].ef
        for nid in members[r.id]:
            if nid in feeders[r.id]:
                deadline[nid] = ms_ef

    # --------------------------------------------------------- backward pass
    finish_bound: dict[str, int] = {}
    start_bound: dict[str, int | None] = {}
    for nid in reversed(order):
        n = nodes[nid]
        lf = deadline.get(nid, project_end)
        ls_from_start: int | None = None
        g = gate.get(nid, 0)
        for e in outgoing[nid]:
            if e.type == "ROLLUP":
                continue
            s = nodes[e.dst]
            if e.type == "FS":
                b = unshift(s.ls, e.lag) - g
                lf = min(lf, b)
            elif e.type == "FF":
                b = unshift(s.lf, e.lag) - g
                lf = min(lf, b)
            elif e.type == "SS":
                b = unshift(s.ls, e.lag) - g  # bound on this node's start
                ls_from_start = b if ls_from_start is None else min(ls_from_start, b)
            else:  # SF: this node's start <= successor finish - lag
                b = unshift(s.lf, e.lag) - g
                ls_from_start = b if ls_from_start is None else min(ls_from_start, b)
        if n.is_summary:
            # constraints coming from the summary's own successors flow to its leaves
            finish_bound[nid] = lf
            start_bound[nid] = ls_from_start
            continue
        # leaf: also honour bounds inherited from every summary ancestor
        for anc in ancestors(nid, by_id):
            if anc in finish_bound:
                lf = min(lf, finish_bound[anc])
                sb = start_bound.get(anc)
                if sb is not None and n.es == nodes[anc].es:
                    lf = min(lf, sb + n.dur)
        if ls_from_start is not None:
            lf = min(lf, ls_from_start + n.dur)
        c = n.task.constraint
        if c is not None and c.type == "FNLT":  # deadline: float may go negative
            lf = min(lf, cal.index_of(cal.prev_working(c.date)) + 1)
        n.lf = lf
        n.ls = lf - n.dur
        n.tf = n.ls - n.es

    # free float for leaves
    for nid, n in nodes.items():
        if n.is_summary:
            continue
        slack: int | None = None
        g = gate.get(nid, 0)
        for e in outgoing[nid]:
            if e.type == "ROLLUP":
                continue
            s = nodes[e.dst]
            if e.type == "FS":
                v = s.es - shift(n.ef + g, e.lag)
            elif e.type == "SS":
                v = s.es - shift(n.es + g, e.lag)
            elif e.type == "FF":
                v = s.ef - shift(n.ef + g, e.lag)
            else:
                v = s.ef - shift(n.es + g, e.lag)
            slack = v if slack is None else min(slack, v)
        n.ff = max(0, deadline.get(nid, project_end) - n.ef) if slack is None else max(0, slack)

    # summaries: float = min of leaves, late dates derived from it
    for n in nodes.values():
        if not n.is_summary:
            continue
        leaf_nodes = [nodes[i] for i in n.leaves]
        if not leaf_nodes:
            n.tf = n.ff = max(0, project_end - n.ef)
            n.ls, n.lf = n.es + n.tf, n.ef + n.tf
            continue
        n.tf = min(x.tf for x in leaf_nodes)
        n.ff = min(x.ff for x in leaf_nodes)
        n.ls = n.es + n.tf
        n.lf = n.ef + n.tf

    # ------------------------------------------------------------- progress
    rollup = project.rules.progress_rollup
    units_by_task: dict[str, int] = defaultdict(int)
    for a in project.assignments:
        units_by_task[a.task_id] += a.units

    def weight(leaf: _Node) -> float:
        if rollup == "count":
            return 1.0
        base = float(leaf.dur) if leaf.dur > 0 else 0.5  # milestones count a little
        if rollup == "effort":
            return base * (units_by_task.get(leaf.task.id) or 100) / 100.0
        return base

    def rolled_progress(leaf_ids: list[str]) -> int:
        if not leaf_ids:
            return 0
        total = 0.0
        acc = 0.0
        for lid in leaf_ids:
            leaf = nodes[lid]
            w = weight(leaf)
            total += w
            if rollup == "count":
                p = 100 if leaf.task.progress >= 100 else 0
            else:
                p = leaf.task.progress
            acc += w * p
        return int(acc / total + 0.5) if total > 0 else 0

    for n in nodes.values():
        n.progress = rolled_progress(n.leaves) if n.is_summary else n.task.progress

    # ------------------------------------------------------------------ wbs
    roots = sorted(
        (t.id for t in project.tasks if t.parent_id is None), key=lambda i: (by_id[i].order, i)
    )
    numbering = wbs_numbers(children, roots)

    # -------------------------------------------------------------- results
    near_n = project.rules.near_critical_float_days
    out: dict[str, TaskSchedule] = {}
    for nid, n in nodes.items():
        wbs, depth = numbering[nid]
        is_ms = (not n.is_summary) and n.dur == 0
        if is_ms:
            start_d = end_d = _milestone_date(cal, n.es)
            lstart_d = lend_d = _milestone_date(cal, n.ls)
        else:
            start_d, end_d = cal.day(n.es), cal.day(max(n.es, n.ef - 1))
            lstart_d, lend_d = cal.day(n.ls), cal.day(max(n.ls, n.lf - 1))
        is_crit = n.tf <= 0
        out[nid] = TaskSchedule(
            id=nid,
            wbs=wbs,
            is_summary=n.is_summary,
            is_milestone=is_ms,
            duration=n.dur,
            start=start_d,
            end=end_d,
            early_start=start_d,
            early_finish=end_d,
            late_start=lstart_d,
            late_finish=lend_d,
            es=n.es,
            ef=n.ef,
            ls=n.ls,
            lf=n.lf,
            total_float=n.tf,
            free_float=n.ff,
            is_critical=is_crit,
            is_near_critical=(not is_crit) and n.tf <= near_n,
            progress=n.progress,
            depth=depth,
        )

    leaves_all = [nid for nid, n in nodes.items() if not n.is_summary]
    critical_path = sorted(
        (nid for nid in leaves_all if out[nid].is_critical),
        key=lambda i: (nodes[i].es, nodes[i].ef, i),
    )
    # ------------------------------------------------------------- health
    for nid in leaves_all:
        exp, health = task_health(project, out[nid], nodes[nid].task.progress, cal, today)
        out[nid].expected_progress = exp
        out[nid].health = health
    for nid, n in nodes.items():
        if n.is_summary:
            kids = [out[i] for i in n.leaves]
            if any(k.health == "late" for k in kids):
                out[nid].health = "late"
            elif kids and all(k.health == "done" for k in kids):
                out[nid].health = "done"
            elif any(k.health in ("on_track", "done") for k in kids):
                out[nid].health = "on_track"
            else:
                out[nid].health = "not_started"

    buffer = compute_buffer(project, nodes, cal, project_end, critical_path)
    if project.buffer.method == "ccpm":
        started = [
            nid
            for nid in leaves_all
            if nodes[nid].task.progress > 0
            and not out[nid].is_milestone
            and nodes[nid].dur > 0
            and today >= out[nid].start  # progress logged before the start date is not evidence
        ]
        ahead = [nid for nid in started if _is_ahead(out[nid], nodes[nid].task.progress, today)]
        if len(started) >= PADDING_MIN_STARTED and len(ahead) * 100 > len(started) * PADDING_RATIO:
            buffer.padding_warning = True
            buffer.padding_note = (
                f"งานที่เริ่มแล้ว {len(ahead)} จาก {len(started)} งาน คืบหน้าเร็วกว่าแผนมาก "
                "ค่าประเมินอาจมีเผื่อในตัวอยู่แล้ว การใช้ Critical Chain จะเผื่อซ้ำซ้อน "
                "ลองเปลี่ยนวิธีสำรองเวลาเป็น 'บวกเพิ่มตามความเสี่ยง' หรือลดค่าประเมินลง"
            )
    planned_end = cal.day(project_end - 1) if project_end > 0 else (cal.start if nodes else None)
    if not nodes:
        planned_end = None
    chain_progress = rolled_progress(critical_path) if critical_path else 0
    buffer.chain_progress = chain_progress
    if project.baseline is not None and buffer.days > 0 and planned_end is not None:
        base_end = project.baseline.planned_end
        slip = cal.count_working_days(base_end, planned_end) - 1 if planned_end > base_end else 0
        consumed = max(0, slip)
        buffer.consumed_days = consumed
        ref_days = project.baseline.buffer_days or buffer.days
        buffer.consumed_percent = min(999, int(round(consumed * 100 / ref_days)))
        z = project.rules.buffer_zones
        ratio = buffer.consumed_percent / max(chain_progress, 1) * 100
        if buffer.consumed_percent >= 100 or ratio > z.red:
            buffer.status = "red"
        elif ratio > z.yellow or (buffer.consumed_percent > 0 and chain_progress == 0):
            buffer.status = "yellow"
        else:
            buffer.status = "green"
    summary = ScheduleSummary(
        task_count=len(leaves_all),
        critical_count=len(critical_path),
        near_critical_count=sum(1 for nid in leaves_all if out[nid].is_near_critical),
        progress=rolled_progress(leaves_all),
        chain_days=project_end,
        planned_end=planned_end,
        committed_end=buffer.committed_end,
        late_count=sum(1 for nid in leaves_all if out[nid].health == "late"),
        baseline_planned_end=project.baseline.planned_end if project.baseline else None,
    )
    releases = compute_releases(
        project, nodes, cal, out, order, incoming, releases_valid, members, feeders, rolled_progress
    )
    feeding = compute_feeding_buffers(project, nodes, cal, out, order, incoming)
    return Schedule(
        tasks=out,
        critical_path=critical_path,
        summary=summary,
        buffer=buffer,
        releases=releases,
        feeding_buffers=feeding,
    )


PADDING_MIN_STARTED = 3  # BUF-7 needs a few data points before it speaks up
PADDING_RATIO = 30  # % of started tasks that must be well ahead of plan


def _is_ahead(s: TaskSchedule, progress: int, today: date) -> bool:
    """Well ahead = 30+ points past the linear expectation, or finished before its planned end."""
    if progress >= 100:
        return today < s.end
    return progress - s.expected_progress > PADDING_RATIO


def task_health(
    project: Project, s: TaskSchedule, progress: int, cal: WorkCalendar, today: date
) -> tuple[int, str]:
    """(expected progress %, health) for a leaf task per rules.late_detection (SET-3).

    linear   - expected = working days elapsed inside the task / duration
    baseline - same, but measured against the baseline window of the task
    overdue  - late only once the planned end has passed
    A 10-point tolerance keeps "late" for real slips, not rounding.
    """
    if progress >= 100:
        return 100, "done"
    mode = project.rules.late_detection
    start, end = s.start, s.end
    if mode == "baseline" and project.baseline and s.id in project.baseline.tasks:
        b = project.baseline.tasks[s.id]
        start, end = b.start, b.end
    if today < start:
        return 0, "not_started"
    if s.is_milestone:
        return (100, "late") if today > end else (0, "not_started")
    if mode == "overdue":
        if today > end:
            return 100, "late"
        return 0, "on_track"
    total = max(1, cal.count_working_days(start, end))
    elapsed = total if today > end else min(total, cal.count_working_days(start, today))
    expected = int(round(elapsed * 100 / total))
    if progress + 10 < expected:
        return expected, "late"
    return expected, ("on_track" if (progress > 0 or expected > 0) else "not_started")


def _milestone_date(cal: WorkCalendar, boundary: int) -> date:
    return cal.day(boundary - 1) if boundary > 0 else cal.day(0)


# ----------------------------------------------------------------------- buffer


def size_buffer(
    settings: BufferSettings,
    chain: int,
    chain_tasks: list[str],
    nodes: dict[str, _Node],
    days_override: int | None = None,
) -> tuple[int, int | None, str | None]:
    """(days, percent used, note) for a chain of `chain` working days per the buffer method.

    `days_override` wins over everything (project-wide `settings.days` or a release's own).
    """
    note: str | None = None
    percent_used: int | None = None
    override = days_override if days_override is not None else settings.days
    if override is not None:
        return override, None, "กำหนดจำนวนวันเอง"
    if chain == 0:
        return 0, None, None
    if settings.method == "ccpm":
        percent_used = settings.ccpm_ratio
        days = math.ceil(chain * settings.ccpm_ratio / 100)
    elif settings.method == "percent":
        percent_used = (
            settings.percent if settings.percent is not None else RISK_PERCENT[settings.risk_level]
        )
        days = math.ceil(chain * percent_used / 100)
    else:  # pert
        z = PERT_Z[settings.pert_confidence]
        variance = 0.0
        missing = 0
        for tid in chain_tasks:
            est = nodes[tid].task.estimate
            if est is None:
                if nodes[tid].dur > 0:
                    missing += 1
                continue
            sigma = (est.p - est.o) / 6.0
            variance += sigma * sigma
        days = math.ceil(z * math.sqrt(variance))
        if missing:
            note = f"ยังไม่มีค่าประเมิน 3 ค่าใน {missing} งานบน critical path"
    if chain > 5:
        days = max(days, 1)
    return days, percent_used, note


def compute_buffer(
    project: Project,
    nodes: dict[str, _Node],
    cal: WorkCalendar,
    project_end: int,
    critical_path: list[str],
) -> BufferResult:
    settings = project.buffer
    chain = project_end
    days, percent_used, note = size_buffer(settings, chain, critical_path, nodes)

    mr_days = math.ceil(chain * settings.management_reserve_percent / 100) if chain else 0
    # the buffer starts where the plan ends; once a baseline exists it is frozen there
    boundary = project_end
    start_day: date | None = cal.day(project_end - 1) if project_end > 0 else None
    ahead_days = 0
    committed_end: date | None = None
    if project.baseline is not None and project.baseline.buffer_days > 0:
        # The buffer itself always follows the current plan (size from the current chain, drawn
        # right after the last task). What the baseline freezes is the COMMITTED date: the
        # promise made when the baseline was saved. Finishing earlier than the baseline shows
        # as "ahead"; slipping past it consumes the (baseline-sized) buffer.
        base_boundary = cal.index_of(project.baseline.planned_end) + 1
        committed_end = cal.day(base_boundary + project.baseline.buffer_days - 1)
        if project_end - 1 < base_boundary - 1:
            ahead_days = (base_boundary - 1) - (project_end - 1)
    end = cal.day(boundary + days - 1) if boundary + days > 0 and days > 0 else None
    mr_end = cal.day(boundary + days + mr_days - 1) if mr_days and end is not None else None
    if chain == 0:
        end = None
        start_day = None
    return BufferResult(
        method=settings.method,
        chain_days=chain,
        days=days,
        start=start_day,
        end=end,
        management_reserve_days=mr_days,
        management_reserve_end=mr_end,
        percent_used=percent_used,
        note=note,
        ahead_days=ahead_days,
        committed_end=committed_end or end,
    )


# ------------------------------------------------------------------ releases


def release_membership(
    project: Project, nodes: dict[str, _Node], outgoing: dict[str, list[_Edge]]
) -> tuple[list[Release], dict[str, list[str]], dict[str, set[str]]]:
    """Releases ordered by milestone date, the leaf tasks of each one, and who feeds each milestone.

    A leaf belongs to the earliest release whose milestone it can reach through dependencies
    (the milestone itself included). Leaves that reach no release milestone fall into the last
    release, so every task is covered by exactly one buffer. Releases whose milestone no longer
    exists (or is a group) are skipped.
    """
    valid = [
        r
        for r in project.releases
        if r.milestone_task_id in nodes and not nodes[r.milestone_task_id].is_summary
    ]
    if not valid:
        return [], {}, {}
    valid.sort(key=lambda r: (nodes[r.milestone_task_id].ef, nodes[r.milestone_task_id].es, r.id))
    # reachability: every leaf that can reach each milestone (reverse BFS over real edges)
    incoming: dict[str, list[str]] = defaultdict(list)
    for src, edges in outgoing.items():
        for e in edges:
            if e.type != "ROLLUP":
                incoming[e.dst].append(src)
    feeders: dict[str, set[str]] = {}
    for r in valid:
        seen = {r.milestone_task_id}
        stack = [r.milestone_task_id]
        while stack:
            cur = stack.pop()
            for p in incoming.get(cur, []):
                if p not in seen:
                    seen.add(p)
                    stack.append(p)
        feeders[r.id] = seen
    members: dict[str, list[str]] = {r.id: [] for r in valid}
    for nid, n in nodes.items():
        if n.is_summary:
            continue
        home = next((r.id for r in valid if nid in feeders[r.id]), valid[-1].id)
        members[home].append(nid)
    return valid, members, feeders


def release_chain(
    nodes: dict[str, _Node],
    order: list[str],
    incoming: dict[str, list[_Edge]],
    member_set: set[str],
) -> tuple[int, list[str]]:
    """Longest path (sum of durations) through the release's own tasks, and the tasks on it.

    Predecessors outside the release count as the start of the chain; lags and waiting gaps
    are not part of the chain, so a task parked by a constraint does not inflate the buffer.
    """
    dist: dict[str, int] = {}
    prev: dict[str, str | None] = {}
    best_end: str | None = None
    for nid in order:
        if nid not in member_set:
            continue
        n = nodes[nid]
        best_p: str | None = None
        best_d = 0
        for e in incoming[nid]:
            if e.type == "ROLLUP" or e.src not in member_set:
                continue
            if dist[e.src] > best_d or best_p is None:
                best_d, best_p = dist[e.src], e.src
        dist[nid] = best_d + n.dur
        prev[nid] = best_p
        if best_end is None or dist[nid] > dist[best_end]:
            best_end = nid
    if best_end is None:
        return 0, []
    path: list[str] = []
    cur: str | None = best_end
    while cur is not None:
        path.append(cur)
        cur = prev[cur]
    path.reverse()
    return dist[best_end], path


def compute_releases(
    project: Project,
    nodes: dict[str, _Node],
    cal: WorkCalendar,
    out: dict[str, TaskSchedule],
    order: list[str],
    incoming: dict[str, list[_Edge]],
    valid: list[Release],
    members: dict[str, list[str]],
    feeders: dict[str, set[str]],
    progress_of: Callable[[list[str]], int],
) -> list[ReleaseResult]:
    results: list[ReleaseResult] = []
    for r in valid:
        ids = members[r.id]
        ms = nodes[r.milestone_task_id]
        member_set = set(ids)
        chain, path = release_chain(nodes, order, incoming, member_set)
        days, percent_used, note = size_buffer(project.buffer, chain, path, nodes, r.days)
        # the release ends at its milestone, or later if orphan tasks (last release) run past it
        boundary = max([ms.ef] + [nodes[i].ef for i in ids if i not in feeders[r.id]])
        planned_end = _milestone_date(cal, boundary) if ids else None
        end = cal.day(boundary + days - 1) if days > 0 else planned_end
        committed_end: date | None = None
        ahead = 0
        consumed_days: int | None = None
        consumed_percent: int | None = None
        status: str | None = None
        critical_ids = [i for i in ids if out[i].is_critical and nodes[i].dur > 0]
        progress = progress_of(ids)
        chain_progress = progress_of(critical_ids or [i for i in path if nodes[i].dur > 0] or ids)
        base = project.baseline.releases.get(r.id) if project.baseline else None
        if base is not None and planned_end is not None:
            base_boundary = cal.index_of(base.planned_end) + 1
            committed_end = base.planned_end
            if base.buffer_days > 0:
                committed_end = cal.day(base_boundary + base.buffer_days - 1)
            if boundary < base_boundary:
                ahead = base_boundary - boundary
            slip = max(0, boundary - base_boundary)
            consumed_days = slip
            ref = base.buffer_days or days
            if ref > 0:
                consumed_percent = min(999, int(round(slip * 100 / ref)))
                z = project.rules.buffer_zones
                ratio = consumed_percent / max(chain_progress, 1) * 100
                if consumed_percent >= 100 or ratio > z.red:
                    status = "red"
                elif ratio > z.yellow or (consumed_percent > 0 and chain_progress == 0):
                    status = "yellow"
                else:
                    status = "green"
        results.append(
            ReleaseResult(
                id=r.id,
                name=r.name,
                milestone_task_id=r.milestone_task_id,
                task_ids=sorted(ids, key=lambda i: (nodes[i].es, nodes[i].ef, i)),
                chain_days=chain,
                days=days,
                planned_end=planned_end,
                end=end,
                committed_end=committed_end or end,
                progress=progress,
                chain_progress=chain_progress,
                chain_task_ids=path,
                consumed_percent=consumed_percent,
                consumed_days=consumed_days,
                status=status,
                ahead_days=ahead,
                percent_used=percent_used,
                note=note,
            )
        )
    return results


# ------------------------------------------------------------ feeding buffers


def compute_feeding_buffers(
    project: Project,
    nodes: dict[str, _Node],
    cal: WorkCalendar,
    out: dict[str, TaskSchedule],
    order: list[str],
    incoming: dict[str, list[_Edge]],
) -> list[FeedingBuffer]:
    """BUF-6 (ccpm only): at every point where a non-critical chain joins a critical task,
    the feeding chain should keep ccpm_ratio% of its length as slack. We do not move tasks;
    we report the recommended size and whether the chain's float already covers it."""
    if project.buffer.method != "ccpm":
        return []
    ratio = project.buffer.ccpm_ratio
    is_leaf = {nid for nid, n in nodes.items() if not n.is_summary}
    noncrit = {nid for nid in is_leaf if not out[nid].is_critical}
    dist: dict[str, int] = {}
    for nid in order:
        if nid not in noncrit:
            continue
        best = 0
        for e in incoming[nid]:
            if e.type != "ROLLUP" and e.src in noncrit:
                best = max(best, dist[e.src])
        dist[nid] = best + nodes[nid].dur
    results: list[FeedingBuffer] = []
    seen: set[str] = set()
    for nid in order:
        if nid not in is_leaf or not out[nid].is_critical:
            continue
        for e in incoming[nid]:
            if e.type == "ROLLUP" or e.src not in noncrit or e.src in seen:
                continue
            chain = dist[e.src]
            if chain <= 0:
                continue
            seen.add(e.src)
            days = math.ceil(chain * ratio / 100)
            if chain > 5:
                days = max(days, 1)
            available = out[e.src].total_float
            src_ef = nodes[e.src].ef
            results.append(
                FeedingBuffer(
                    from_task_id=e.src,
                    to_task_id=nid,
                    dependency_id=e.dep_id,
                    chain_days=chain,
                    days=days,
                    available_days=available,
                    ok=available >= days,
                    start=cal.day(src_ef) if days > 0 else None,
                    end=cal.day(src_ef + days - 1) if days > 0 else None,
                )
            )
    return results


# ------------------------------------------------------------------- utilities


def dependency_targets(dep: Dependency) -> tuple[str, str]:
    return dep.from_, dep.to
