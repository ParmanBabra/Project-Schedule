"""Scheduling engine tests. Project start Monday 2026-09-14, Mon–Fri working days."""

import time
from datetime import date

import pytest

from app.core.errors import CycleDetected, ValidationFailed
from app.core.models import BufferSettings, Constraint, Estimate, Rules
from app.features.scheduling.engine import compute_schedule, validate_dependencies
from tests.factories import dep, project, sample_project, task

D = date


def sched(p):
    return compute_schedule(p)


# ------------------------------------------------------------------ basics


def test_single_task_spans_working_days():
    s = sched(project([task("a", 5)]))
    a = s.tasks["a"]
    assert (a.start, a.end) == (D(2026, 9, 14), D(2026, 9, 18))
    assert a.total_float == 0 and a.is_critical
    assert s.summary.planned_end == D(2026, 9, 18)
    assert s.critical_path == ["a"]


def test_fs_chain_skips_weekend():
    s = sched(project([task("a", 3), task("b", 5)], [dep("a", "b")]))
    b = s.tasks["b"]
    assert (b.start, b.end) == (D(2026, 9, 17), D(2026, 9, 23))
    assert s.summary.chain_days == 8


def test_parallel_branch_has_float_and_is_not_critical():
    p = project([task("a", 3), task("b", 5), task("c", 4)], [dep("a", "b"), dep("a", "c")])
    s = sched(p)
    assert s.tasks["c"].total_float == 1
    assert s.tasks["c"].free_float == 1
    assert not s.tasks["c"].is_critical and not s.tasks["c"].is_near_critical
    assert s.tasks["c"].late_finish == D(2026, 9, 23)
    assert s.critical_path == ["a", "b"]


def test_near_critical_threshold_rule():
    p = project(
        [task("a", 3), task("b", 5), task("c", 4)],
        [dep("a", "b"), dep("a", "c")],
        rules=Rules(near_critical_float_days=1),
    )
    s = sched(p)
    assert s.tasks["c"].is_near_critical and not s.tasks["c"].is_critical
    assert s.summary.near_critical_count == 1 and s.summary.critical_count == 2


def test_sample_project_matches_docs():
    s = sched(sample_project())
    assert s.summary.planned_end == D(2026, 10, 6)
    assert s.summary.chain_days == 17
    assert s.critical_path == ["t1", "t2", "t4", "t6"]
    assert s.tasks["t3"].total_float == 2 and s.tasks["t5"].total_float == 2
    assert s.tasks["t2"].start == D(2026, 9, 17) and s.tasks["t2"].end == D(2026, 9, 23)
    assert s.tasks["t6"].start == D(2026, 10, 2) and s.tasks["t6"].end == D(2026, 10, 6)


# --------------------------------------------------------- dependency types


def test_ss_with_positive_lag():
    s = sched(project([task("a", 5), task("b", 2)], [dep("a", "b", "SS", 2)]))
    assert s.tasks["b"].start == D(2026, 9, 16)
    assert s.tasks["b"].total_float == 1
    assert s.tasks["a"].total_float == 0


def test_ff_aligns_finishes():
    s = sched(project([task("a", 5), task("b", 2)], [dep("a", "b", "FF")]))
    assert s.tasks["b"].end == s.tasks["a"].end == D(2026, 9, 18)
    assert s.tasks["b"].start == D(2026, 9, 17)
    assert s.tasks["a"].is_critical and s.tasks["b"].is_critical


def test_sf_never_schedules_before_project_start():
    s = sched(project([task("a", 3), task("b", 2)], [dep("a", "b", "SF")]))
    assert s.tasks["b"].start == D(2026, 9, 14)
    assert s.summary.chain_days == 3


def test_negative_lag_overlaps_tasks():
    s = sched(project([task("a", 3), task("b", 2)], [dep("a", "b", "FS", -1)]))
    assert s.tasks["b"].start == D(2026, 9, 16)
    assert s.tasks["a"].total_float == 0 and s.tasks["b"].total_float == 0


def test_calendar_lag_counts_weekend_days():
    thu = D(2026, 9, 17)
    working = project([task("a", 1), task("b", 1)], [dep("a", "b", "FS", 2)])
    working.start_date = thu
    calendar = project(
        [task("a", 1), task("b", 1)], [dep("a", "b", "FS", 2)], rules=Rules(lag_unit="calendar")
    )
    calendar.start_date = thu
    assert sched(working).tasks["b"].start == D(2026, 9, 22)  # Fri, Mon skipped as lag -> Tue
    assert sched(calendar).tasks["b"].start == D(2026, 9, 21)  # Fri + 2 calendar days = Sun -> Mon
    assert sched(calendar).tasks["a"].total_float == 0


# ------------------------------------------------------ calendar & constraints


def test_holiday_extends_task():
    p = project([task("a", 3)])
    p.holidays = [D(2026, 9, 15)]
    assert sched(p).tasks["a"].end == D(2026, 9, 17)


def test_snet_constraint_pushes_start_to_next_working_day():
    p = project([task("a", 2, constraint=Constraint(date=D(2026, 9, 19)))])  # Saturday
    a = sched(p).tasks["a"]
    assert (a.start, a.end) == (D(2026, 9, 21), D(2026, 9, 22))


def test_milestone_sits_on_predecessor_end_date():
    s = sched(project([task("a", 3), task("m", 0, milestone=True)], [dep("a", "m")]))
    m = s.tasks["m"]
    assert m.is_milestone and m.start == m.end == D(2026, 9, 16)
    assert m.is_critical and s.summary.planned_end == D(2026, 9, 16)


def test_milestone_at_project_start():
    m = sched(project([task("m", 0, milestone=True)])).tasks["m"]
    assert m.start == D(2026, 9, 14)


def test_empty_project():
    s = sched(project([]))
    assert s.tasks == {} and s.summary.planned_end is None and s.buffer.days == 0


# ----------------------------------------------------------------- WBS


def test_summary_rolls_up_dates_progress_and_wbs():
    p = project(
        [
            task("s", 0, order=1),
            task("a", 3, parent="s", order=1, progress=100),
            task("b", 5, parent="s", order=2, progress=40),
            task("c", 2, order=2),
        ],
        [dep("a", "b"), dep("s", "c")],
    )
    s = sched(p)
    summ = s.tasks["s"]
    assert summ.is_summary and (summ.start, summ.end) == (D(2026, 9, 14), D(2026, 9, 23))
    assert summ.duration == 8 and summ.progress == 63  # (100*3 + 40*5) / 8 = 62.5 -> 63
    assert s.tasks["c"].start == D(2026, 9, 24)  # FS from the summary = after its last leaf
    assert (s.tasks["s"].wbs, s.tasks["a"].wbs, s.tasks["b"].wbs, s.tasks["c"].wbs) == (
        "1",
        "1.1",
        "1.2",
        "2",
    )
    assert s.tasks["a"].depth == 1 and s.tasks["c"].depth == 0
    assert summ.is_critical and summ.total_float == 0
    assert s.summary.task_count == 3  # leaves only


def test_dependency_into_summary_applies_to_all_children():
    p = project(
        [
            task("x", 2, order=1),
            task("s", 0, order=2),
            task("a", 1, parent="s"),
            task("b", 1, parent="s"),
        ],
        [dep("x", "s")],
    )
    s = sched(p)
    assert s.tasks["a"].start == D(2026, 9, 16) and s.tasks["b"].start == D(2026, 9, 16)


def test_summary_float_is_min_of_children():
    p = project(
        [
            task("s", 0, order=1),
            task("a", 2, parent="s"),
            task("b", 6, parent="s"),
            task("c", 8, order=2),
        ],
    )
    s = sched(p)
    assert s.tasks["a"].total_float == 6 and s.tasks["b"].total_float == 2
    assert s.tasks["s"].total_float == 2 and not s.tasks["s"].is_critical


def test_progress_rollup_by_count():
    p = project(
        [
            task("s", 0),
            task("a", 1, parent="s", progress=100),
            task("b", 9, parent="s", progress=50),
        ],
        rules=Rules(progress_rollup="count"),
    )
    assert sched(p).tasks["s"].progress == 50


def test_dependency_within_same_branch_is_rejected():
    p = project([task("s", 0), task("a", 1, parent="s")], [dep("a", "s")])
    with pytest.raises(ValidationFailed):
        sched(p)


def test_unknown_parent_is_rejected():
    with pytest.raises(ValidationFailed):
        sched(project([task("a", 1, parent="ghost")]))


# --------------------------------------------------------------- validation


def test_cycle_is_reported_with_path():
    p = project([task("a"), task("b"), task("c")], [dep("a", "b"), dep("b", "c"), dep("c", "a")])
    with pytest.raises(CycleDetected) as exc:
        validate_dependencies(p)
    assert set(exc.value.path) == {"a", "b", "c"}
    assert exc.value.path[0] == exc.value.path[-1]


def test_duplicate_and_self_dependencies_are_rejected():
    with pytest.raises(ValidationFailed):
        sched(project([task("a"), task("b")], [dep("a", "b"), dep("a", "b", id="dup")]))
    with pytest.raises(ValidationFailed):
        sched(project([task("a")], [dep("a", "a")]))


# ------------------------------------------------------------------ buffer


def test_ccpm_buffer_is_half_the_chain_and_sets_committed_end():
    s = sched(sample_project())
    assert s.buffer.method == "ccpm" and s.buffer.chain_days == 17
    assert s.buffer.days == 9 and s.buffer.end == D(2026, 10, 19)
    assert s.buffer.management_reserve_days == 1 and s.buffer.management_reserve_end == D(
        2026, 10, 20
    )
    assert s.summary.committed_end == D(2026, 10, 19)


def test_percent_buffer_by_risk_level():
    p = sample_project()
    p.buffer = BufferSettings(method="percent", risk_level="medium")
    assert sched(p).buffer.days == 3  # ceil(17 * 0.15)
    p.buffer = BufferSettings(method="percent", risk_level="high")
    assert sched(p).buffer.days == 5  # ceil(17 * 0.25)
    p.buffer = BufferSettings(method="percent", percent=0)
    assert sched(p).buffer.days == 1  # minimum 1 day when chain > 5


def test_pert_buffer_uses_variance_along_critical_path():
    p = sample_project()
    for t in p.tasks:
        t.estimate = Estimate(o=t.duration - 1, m=t.duration, p=t.duration + 5)  # sigma = 1
    p.buffer = BufferSettings(method="pert", pert_confidence=84)
    b = sched(p).buffer
    assert b.days == 2  # sqrt(4 tasks * 1) = 2
    p.buffer = BufferSettings(method="pert", pert_confidence=98)
    assert sched(p).buffer.days == 4
    p.tasks[0].estimate = None
    assert "1 งาน" in (sched(p).buffer.note or "")


def test_manual_buffer_days_override():
    p = sample_project()
    p.buffer = BufferSettings(days=2)
    b = sched(p).buffer
    assert b.days == 2 and b.end == D(2026, 10, 8)


# ------------------------------------------------------------- performance


def test_500_tasks_schedule_under_100ms():
    tasks = [task(f"t{i}", 1 + i % 5, order=i) for i in range(500)]
    deps = [dep(f"t{i - 1}", f"t{i}") for i in range(1, 500)]
    deps += [dep(f"t{i - 7}", f"t{i}", "SS", 1) for i in range(7, 500, 3)]
    p = project(tasks, deps)
    sched(p)  # warm-up
    t0 = time.perf_counter()
    s = sched(p)
    elapsed = time.perf_counter() - t0
    assert s.summary.task_count == 500
    assert elapsed < 0.1, f"took {elapsed * 1000:.1f} ms"


# ------------------------------------------------------------ health / baseline


def test_health_linear_marks_late_when_progress_trails_elapsed_time():
    p = sample_project()  # t2: 17–23 Sep, progress 40
    s = compute_schedule(p, today=D(2026, 9, 22))  # 4 of 5 working days elapsed -> expected 80
    assert s.tasks["t2"].expected_progress == 80 and s.tasks["t2"].health == "late"
    assert s.tasks["t1"].health == "done"
    assert s.tasks["t4"].health == "not_started"  # starts 24 Sep
    assert s.summary.late_count == 2  # t2 and t3 (25% vs 100% expected: 17–22 elapsed)
    early = compute_schedule(p, today=D(2026, 9, 17))
    assert early.tasks["t2"].health == "on_track" and early.tasks["t2"].expected_progress == 20


def test_health_overdue_only_after_end():
    p = sample_project()
    p.rules = Rules(late_detection="overdue")
    assert compute_schedule(p, today=D(2026, 9, 22)).tasks["t2"].health == "on_track"
    assert compute_schedule(p, today=D(2026, 9, 24)).tasks["t2"].health == "late"
    assert compute_schedule(p, today=D(2026, 9, 24)).tasks["t2"].expected_progress == 100


def test_buffer_consumption_and_fever_zones_after_baseline():
    from app.core.models import Baseline, BaselineTask, utcnow

    p = sample_project()
    base = compute_schedule(p)
    p.baseline = Baseline(
        saved_at=utcnow(),
        planned_end=base.summary.planned_end,
        chain_days=base.summary.chain_days,
        buffer_days=base.buffer.days,
        tasks={k: BaselineTask(start=v.start, end=v.end) for k, v in base.tasks.items()},
    )
    s = compute_schedule(p)
    assert s.buffer.consumed_days == 0 and s.buffer.consumed_percent == 0
    assert s.buffer.status == "green" and s.summary.baseline_planned_end == D(2026, 10, 6)
    committed = s.buffer.committed_end
    assert committed == s.buffer.end and s.buffer.ahead_days == 0

    # finishing early: the promise stays, the buffer shrinks with the shorter chain
    p.tasks[3].duration = 1  # พัฒนา Backend 6 -> 1 (Frontend path now critical: 15 days)
    early = compute_schedule(p)
    assert early.buffer.committed_end == committed and early.summary.committed_end == committed
    assert early.buffer.days == 8 and early.buffer.start == early.summary.planned_end
    assert early.buffer.end < committed and early.buffer.ahead_days == 2
    assert early.buffer.consumed_percent == 0
    p.tasks[3].duration = 6

    # slip the critical chain by 3 working days: consumed 3/9 = 33%, chain progress ~? -> compare
    p.tasks[3].duration = 9  # พัฒนา Backend 6 -> 9
    s = compute_schedule(p)
    assert s.summary.planned_end == D(2026, 10, 9) and s.buffer.consumed_days == 3
    assert s.buffer.consumed_percent == 33
    # critical chain progress: t1 100%*3 + t2 40%*5 + t4 0*9 + t6 0*3 = 500/20 = 25%
    # -> ratio 133% > red 120
    assert s.buffer.chain_progress == 25 and s.buffer.status == "red"

    p.rules = Rules(buffer_zones={"yellow": 120, "red": 150})
    assert compute_schedule(p).buffer.status == "yellow"

    p.tasks[3].duration = 20  # eat the whole buffer (measured against the baseline size, 9 days)
    over = compute_schedule(p)
    assert over.buffer.consumed_percent >= 100 and over.buffer.status == "red"
    assert over.buffer.committed_end == committed and over.buffer.end > committed


def test_health_baseline_mode_uses_frozen_dates():
    from app.core.models import Baseline, BaselineTask, utcnow

    p = sample_project()
    base = compute_schedule(p)
    p.baseline = Baseline(
        saved_at=utcnow(),
        planned_end=base.summary.planned_end,
        chain_days=base.summary.chain_days,
        buffer_days=base.buffer.days,
        tasks={k: BaselineTask(start=v.start, end=v.end) for k, v in base.tasks.items()},
    )
    p.rules = Rules(late_detection="baseline")
    p.tasks[1].duration = 8  # ออกแบบระบบ now runs to 28 Sep, but baseline says 23 Sep
    s = compute_schedule(p, today=D(2026, 9, 24))
    assert s.tasks["t2"].expected_progress == 100 and s.tasks["t2"].health == "late"


# ------------------------------------------------------------------- BUF-7


def test_padding_warning_when_most_started_tasks_run_far_ahead():
    from datetime import date as _date

    # 4 parallel 10-day tasks starting 14 ก.ย.; on day 3 (16 ก.ย.) linear expectation is 30%
    tasks = [task(f"t{i}", 10, progress=p, order=i) for i, p in enumerate([90, 80, 100, 20])]
    p = project(tasks=tasks, deps=[])
    sch = compute_schedule(p, today=_date(2026, 9, 16))
    assert sch.buffer.padding_warning is True
    assert "เผื่อซ้ำซ้อน" in (sch.buffer.padding_note or "")
    # percent method never warns; neither does a plan where progress tracks the calendar
    p.buffer.method = "percent"
    assert compute_schedule(p, today=_date(2026, 9, 16)).buffer.padding_warning is False
    p.buffer.method = "ccpm"
    for t, prog in zip(p.tasks, [30, 35, 25, 20], strict=True):
        t.progress = prog
    assert compute_schedule(p, today=_date(2026, 9, 16)).buffer.padding_warning is False
