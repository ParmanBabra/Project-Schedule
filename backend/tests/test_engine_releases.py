"""Release buffers, per-release critical chains, the "after buffer" rule, FNLT deadlines and
feeding buffers (BUF-6, BUF-8, BUF-9). Project start Monday 2026-09-14, Mon–Fri working days.

Layout used by most tests (durations in working days, indexes are working-day boundaries):

    a(3) -> b(5) -> M1                      release 1: a, b, M1        chain a+b = 8
                 \\-> c(4) -> d(2) -> M2      release 2: c, d, M2 (+e)   chain c+d = 6
    e(2)                                    feeds nothing -> falls into the last release
"""

from datetime import UTC, date, datetime

from app.core.models import (
    Baseline,
    BaselineRelease,
    BufferSettings,
    Constraint,
    Release,
    Rules,
)
from app.features.scheduling.engine import compute_schedule
from tests.factories import dep, project, sample_project, task

D = date


def two_releases(**extra):
    return project(
        [
            task("a", 3, order=1),
            task("b", 5, order=2),
            task("m1", 0, order=3, milestone=True),
            task("c", 4, order=4),
            task("d", 2, order=5),
            task("m2", 0, order=6, milestone=True),
            task("e", 2, order=7),
        ],
        [dep("a", "b"), dep("b", "m1"), dep("b", "c"), dep("c", "d"), dep("d", "m2")],
        releases=[
            Release(id="rel_02", name="ปีหน้า", milestone_task_id="m2"),
            Release(id="rel_01", name="ปีนี้", milestone_task_id="m1"),
        ],
        **extra,
    )


def by_id(s):
    return {r.id: r for r in s.releases}


# ------------------------------------------------------------ membership


def test_no_releases_means_empty_list_and_project_buffer_unchanged():
    s = compute_schedule(project([task("a", 3)]))
    assert s.releases == [] and s.feeding_buffers == []
    assert s.buffer.days == 2  # 50% of 3, unchanged behaviour


def test_tasks_belong_to_the_earliest_release_they_feed_and_orphans_get_a_tail_buffer():
    s = compute_schedule(two_releases())
    # ordered by milestone date, the trailing "outside any delivery point" group last
    assert [r.id for r in s.releases] == ["rel_01", "rel_02", "tail"]
    r = by_id(s)
    assert r["rel_01"].task_ids == ["a", "b", "m1"]
    assert r["rel_02"].task_ids == ["c", "d", "m2"]
    tail = r["tail"]  # e never reaches a milestone
    assert tail.task_ids == ["e"] and tail.milestone_task_id == ""
    assert tail.name == "งานนอกจุดส่งมอบ"
    assert tail.chain_days == 2 and tail.days == 1
    assert tail.planned_end == D(2026, 9, 15) and tail.end == D(2026, 9, 16)


def test_no_tail_when_the_orphans_are_only_milestones():
    p = two_releases()
    p.tasks = [t for t in p.tasks if t.id != "e"]
    p.tasks.append(task("handover", 0, order=9, milestone=True))
    assert [r.id for r in compute_schedule(p).releases] == ["rel_01", "rel_02"]


def test_release_pointing_at_a_missing_or_group_task_is_skipped():
    p = two_releases()
    p.releases.append(Release(id="rel_09", name="หาย", milestone_task_id="nope"))
    p.tasks.append(task("g", 1, order=8))
    p.tasks.append(task("g1", 2, order=1, parent="g"))
    p.releases.append(Release(id="rel_10", name="กลุ่ม", milestone_task_id="g"))
    assert [r.id for r in compute_schedule(p).releases] == ["rel_01", "rel_02", "tail"]


# ------------------------------------------------- critical chain per release


def test_each_release_has_its_own_critical_chain_and_deadline():
    s = compute_schedule(two_releases())
    # release 1: a -> b -> m1 are critical for the 23 Sep delivery, even though the project
    # itself ends 1 Oct (before BUF-8 they showed 6 days of float)
    for tid in ("a", "b", "m1"):
        assert s.tasks[tid].is_critical and s.tasks[tid].total_float == 0
    assert s.tasks["m1"].late_finish == D(2026, 9, 23)
    # release 2 chain and the orphan measured against the project end
    for tid in ("c", "d", "m2"):
        assert s.tasks[tid].is_critical
    assert s.tasks["e"].total_float == 12 and not s.tasks["e"].is_critical
    assert s.critical_path == ["a", "b", "m1", "c", "d", "m2"]
    assert s.summary.critical_count == 6


def test_without_releases_the_milestone_has_float_as_before():
    p = two_releases()
    p.releases = []
    s = compute_schedule(p)
    assert s.tasks["m1"].total_float == 6 and not s.tasks["m1"].is_critical


def test_slack_between_a_release_chain_and_its_milestone_is_float():
    # a(3) -> m1 ; b(5) -> m1 : b is the chain, a has 2 days before the 21 Sep delivery
    p = project(
        [task("a", 3, order=1), task("b", 5, order=2), task("m1", 0, order=3, milestone=True)],
        [dep("a", "m1"), dep("b", "m1")],
        releases=[Release(id="rel_01", name="R1", milestone_task_id="m1")],
    )
    s = compute_schedule(p)
    assert s.tasks["a"].total_float == 2 and s.tasks["a"].free_float == 2
    assert s.tasks["b"].is_critical
    assert s.tasks["a"].late_finish == D(2026, 9, 18)


# --------------------------------------------------------- buffer sizing


def test_each_release_buffers_only_its_own_longest_chain():
    s = compute_schedule(two_releases())
    r = by_id(s)
    # release 1: a+b = 8 working days -> 50% = 4
    assert r["rel_01"].chain_days == 8 and r["rel_01"].days == 4
    assert r["rel_01"].chain_task_ids == ["a", "b"]
    assert r["rel_01"].planned_end == D(2026, 9, 23)
    assert r["rel_01"].end == D(2026, 9, 29)
    assert r["rel_01"].committed_end == D(2026, 9, 29)
    # release 2: only c+d = 6 (release 1's work is never buffered twice) -> 3
    assert r["rel_02"].chain_days == 6 and r["rel_02"].days == 3
    assert r["rel_02"].chain_task_ids == ["c", "d"]
    assert r["rel_02"].planned_end == D(2026, 10, 1)
    assert r["rel_02"].end == D(2026, 10, 6)
    # the project-wide buffer still exists for callers that ignore releases
    assert s.buffer.days == 7


def test_waiting_gaps_do_not_inflate_the_chain():
    p = two_releases()
    # d must not start before 6 Oct: the release ends later, but its chain is still c+d
    p.tasks[4].constraint = Constraint(type="SNET", date=D(2026, 10, 6))
    r = by_id(compute_schedule(p))
    assert r["rel_02"].planned_end == D(2026, 10, 7)
    assert r["rel_02"].chain_days == 6 and r["rel_02"].days == 3


def test_a_release_buffer_stays_at_its_milestone_even_when_orphans_run_past_it():
    p = two_releases()
    p.tasks[6].duration = 20  # e: 0..20, past m2 at 14
    r = by_id(compute_schedule(p))
    # the delivery point is untouched: still 1 Oct, chain c+d, buffer right after the milestone
    assert r["rel_02"].planned_end == D(2026, 10, 1) and r["rel_02"].end == D(2026, 10, 6)
    assert r["rel_02"].chain_days == 6 and r["rel_02"].chain_task_ids == ["c", "d"]
    # the long orphan is protected by the trailing buffer instead
    assert r["tail"].planned_end == D(2026, 10, 9)
    assert r["tail"].chain_days == 20 and r["tail"].days == 10


def test_days_override_per_release_and_project_wide_override():
    p = two_releases()
    p.releases[1].days = 10  # rel_01
    r = by_id(compute_schedule(p))
    assert r["rel_01"].days == 10 and r["rel_01"].note == "กำหนดจำนวนวันเอง"
    assert r["rel_02"].days == 3
    p2 = two_releases(buffer=BufferSettings(days=2))
    r2 = by_id(compute_schedule(p2))
    assert r2["rel_01"].days == 2 and r2["rel_02"].days == 2


def test_percent_method_applies_to_each_release():
    p = two_releases(buffer=BufferSettings(method="percent", risk_level="high"))
    r = by_id(compute_schedule(p))
    assert r["rel_01"].days == 2  # ceil(8 * 25%)
    assert r["rel_02"].days == 2  # ceil(6 * 25%)
    assert r["rel_01"].percent_used == 25


def test_single_release_covers_everything_like_the_project_buffer():
    p = project(
        [task("a", 3, order=1), task("b", 5, order=2), task("m", 0, order=3, milestone=True)],
        [dep("a", "b"), dep("b", "m")],
        releases=[Release(id="rel_01", name="ส่งมอบ", milestone_task_id="m")],
    )
    s = compute_schedule(p)
    assert len(s.releases) == 1
    assert s.releases[0].task_ids == ["a", "b", "m"]
    assert s.releases[0].days == s.buffer.days == 4
    assert s.releases[0].end == s.buffer.end


# ------------------------------------------------------- progress & status


def test_release_progress_and_chain_progress():
    p = two_releases()
    p.tasks[0].progress = 100  # a (3 days)
    p.tasks[1].progress = 40  # b (5 days)
    r = by_id(compute_schedule(p))
    # all tasks, duration weighted like the project rollup (a milestone weighs 0.5)
    assert r["rel_01"].progress == int((300 + 200) / 8.5 + 0.5)
    # the chain itself: a + b only
    assert r["rel_01"].chain_progress == int((300 + 200) / 8 + 0.5)
    assert r["rel_02"].progress == 0 and r["rel_02"].chain_progress == 0


def test_baseline_freezes_committed_date_and_tracks_consumption_per_release():
    p = two_releases()
    p.baseline = Baseline(
        saved_at=datetime(2026, 9, 14, tzinfo=UTC),
        planned_end=D(2026, 10, 1),
        chain_days=14,
        buffer_days=7,
        releases={
            "rel_01": BaselineRelease(planned_end=D(2026, 9, 23), buffer_days=4),
            "rel_02": BaselineRelease(planned_end=D(2026, 10, 1), buffer_days=7),
        },
    )
    # release 1 slips 2 working days (b grows to 7); release 2 slips with it
    p.tasks[1].duration = 7
    r = by_id(compute_schedule(p, today=D(2026, 9, 14)))
    one = r["rel_01"]
    assert one.planned_end == D(2026, 9, 25)
    assert one.committed_end == D(2026, 9, 29)  # frozen: baseline end + 4 buffer days
    assert one.consumed_days == 2 and one.consumed_percent == 50
    assert one.status == "red"  # buffer burning while nothing has progressed
    assert one.days == 5  # current size follows the plan (10 days chain)
    two = r["rel_02"]
    assert two.committed_end == D(2026, 10, 12)
    assert two.consumed_days == 2 and two.consumed_percent == int(round(2 * 100 / 7))
    # and a release that finishes earlier than its baseline is "ahead"
    p.tasks[1].duration = 3
    r = by_id(compute_schedule(p))
    assert r["rel_01"].ahead_days == 2 and r["rel_01"].consumed_percent == 0
    assert r["rel_01"].status == "green"
    assert r["rel_01"].committed_end == D(2026, 9, 29)


def test_release_status_uses_chain_progress():
    p = two_releases()
    p.baseline = Baseline(
        saved_at=datetime(2026, 9, 14, tzinfo=UTC),
        planned_end=D(2026, 10, 1),
        chain_days=14,
        buffer_days=7,
        releases={"rel_01": BaselineRelease(planned_end=D(2026, 9, 23), buffer_days=4)},
    )
    p.tasks[0].progress = 100
    p.tasks[1].progress = 80
    p.tasks[1].duration = 6  # 1 day slip = 25% of the buffer vs ~87% chain progress
    r = by_id(compute_schedule(p))
    assert r["rel_01"].consumed_percent == 25 and r["rel_01"].status == "green"
    assert r["rel_02"].status is None  # no baseline entry for it


# ------------------------------------------- rule: successors wait for the buffer


def test_successors_of_a_release_milestone_start_immediately_by_default():
    p = two_releases()
    p.tasks.append(task("f", 2, order=8))
    p.dependencies.append(dep("m1", "f"))
    s = compute_schedule(p)
    assert s.tasks["f"].start == D(2026, 9, 24)  # right after m1 (23 Sep)


def test_after_buffer_rule_delays_only_what_hangs_off_the_milestone():
    p = two_releases(rules=Rules(release_successors="after_buffer"))
    p.tasks.append(task("f", 2, order=8))
    p.dependencies.append(dep("m1", "f"))
    s = compute_schedule(p)
    r = by_id(s)
    # release 1 is unchanged: chain 8, buffer 4, delivered 23 Sep, promised 29 Sep
    assert r["rel_01"].days == 4 and r["rel_01"].planned_end == D(2026, 9, 23)
    # f waits for the 4-day buffer: starts 30 Sep instead of 24 Sep
    assert s.tasks["f"].start == D(2026, 9, 30) and s.tasks["f"].end == D(2026, 10, 1)
    # c depends on b (a task, not the milestone) so it still starts right after b
    assert s.tasks["c"].start == D(2026, 9, 24)
    # m1 stays critical for its release; f is critical for the project end it now defines
    assert s.tasks["m1"].is_critical and s.tasks["f"].is_critical
    assert s.tasks["m1"].free_float == 0


def test_after_buffer_rule_does_nothing_without_releases():
    p = project(
        [task("a", 3, order=1), task("m", 0, order=2, milestone=True), task("f", 2, order=3)],
        [dep("a", "m"), dep("m", "f")],
        rules=Rules(release_successors="after_buffer"),
    )
    s = compute_schedule(p)
    assert s.tasks["f"].start == D(2026, 9, 17)


# ---------------------------------------------------------- FNLT deadline


def test_fnlt_deadline_caps_late_finish_and_can_go_negative():
    p = project([task("a", 5, constraint=Constraint(type="FNLT", date=D(2026, 9, 17)))])
    s = compute_schedule(p)
    a = s.tasks["a"]
    assert a.late_finish == D(2026, 9, 17) and a.late_start == D(2026, 9, 11)
    assert a.total_float == -1 and a.is_critical
    # a deadline later than the natural finish changes nothing
    p.tasks[0].constraint = Constraint(type="FNLT", date=D(2026, 9, 30))
    assert compute_schedule(p).tasks["a"].total_float == 0


def test_fnlt_on_a_weekend_means_the_friday_before():
    # b naturally ends Wed 23 Sep; a Saturday 19 Sep deadline means Friday 18 Sep
    p = project(
        [task("a", 3), task("b", 5, constraint=Constraint(type="FNLT", date=D(2026, 9, 19)))],
        [dep("a", "b")],
    )
    s = compute_schedule(p)
    assert s.tasks["b"].late_finish == D(2026, 9, 18) and s.tasks["b"].total_float == -3


def test_fnlt_propagates_to_predecessors():
    p = project(
        [task("a", 3), task("b", 2, constraint=Constraint(type="FNLT", date=D(2026, 9, 18)))],
        [dep("a", "b")],
    )
    s = compute_schedule(p)
    assert s.tasks["b"].total_float == 0 and s.tasks["a"].total_float == 0
    assert s.tasks["a"].late_finish == D(2026, 9, 16)


# --------------------------------------------------------- feeding buffers


def test_feeding_buffer_where_a_non_critical_chain_joins_the_critical_chain():
    s = compute_schedule(sample_project())
    # t3 (UI, 4) -> t5 (Frontend, 5) is the non-critical chain feeding t6 (test): 9 days -> 5
    assert len(s.feeding_buffers) == 1
    fb = s.feeding_buffers[0]
    assert (fb.from_task_id, fb.to_task_id) == ("t5", "t6")
    assert fb.dependency_id == "d_t5_t6"
    assert fb.chain_days == 9 and fb.days == 5
    assert fb.available_days == 2 and fb.ok is False  # only 2 days of float: not enough
    assert (fb.start, fb.end) == (D(2026, 9, 30), D(2026, 10, 6))


def test_feeding_buffer_is_fine_when_the_chain_has_enough_float():
    p = project(
        [task("a", 10, order=1), task("b", 2, order=2), task("z", 1, order=3)],
        [dep("a", "z"), dep("b", "z")],
    )
    s = compute_schedule(p)
    fb = s.feeding_buffers[0]
    assert fb.from_task_id == "b" and fb.chain_days == 2 and fb.days == 1
    assert fb.available_days == 8 and fb.ok is True


def test_feeding_buffers_only_for_ccpm():
    p = sample_project()
    p.buffer = BufferSettings(method="percent")
    assert compute_schedule(p).feeding_buffers == []
