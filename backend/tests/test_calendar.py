from datetime import date

import pytest

from app.features.scheduling.calendar import WorkCalendar

MON = date(2026, 9, 14)


def cal(start=MON, holidays=(), working=(1, 2, 3, 4, 5)) -> WorkCalendar:
    return WorkCalendar(start, working, holidays)


def test_start_snaps_to_next_working_day():
    assert cal(date(2026, 9, 12)).start == MON  # Saturday -> Monday


def test_day_index_skips_weekends_and_holidays():
    c = cal(holidays=[date(2026, 9, 15)])
    assert [c.day(i) for i in range(5)] == [
        date(2026, 9, 14),
        date(2026, 9, 16),
        date(2026, 9, 17),
        date(2026, 9, 18),
        date(2026, 9, 21),
    ]


def test_negative_index_walks_backwards():
    c = cal()
    assert c.day(-1) == date(2026, 9, 11)  # Friday before
    assert c.day(-2) == date(2026, 9, 10)


def test_index_of_roundtrip_and_non_working_input():
    c = cal()
    assert c.index_of(date(2026, 9, 21)) == 5
    assert c.index_of(date(2026, 9, 19)) == 5  # Saturday -> Monday 21
    assert c.index_of(date(2026, 9, 11)) == -1
    assert c.index_of(c.day(37)) == 37


def test_add_and_count_working_days():
    c = cal()
    assert c.add_working_days(date(2026, 9, 18), 1) == date(2026, 9, 21)
    assert c.add_working_days(date(2026, 9, 21), -1) == date(2026, 9, 18)
    assert c.count_working_days(date(2026, 9, 14), date(2026, 9, 27)) == 10
    assert c.count_working_days(date(2026, 9, 20), date(2026, 9, 14)) == 0


def test_six_day_week():
    c = cal(working=(1, 2, 3, 4, 5, 6))
    assert c.day(5) == date(2026, 9, 19)  # Saturday is a working day
    assert c.day(6) == date(2026, 9, 21)


def test_requires_at_least_one_working_day():
    with pytest.raises(ValueError):
        cal(working=())
