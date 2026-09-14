"""Working-day calendar used by the scheduling engine.

Positions on the timeline are integer *working-day indexes*: index 0 is the first
working day on/after the project start. Durations are counted in working days, so
weekends and holidays never consume task time.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, timedelta


class WorkCalendar:
    def __init__(self, start: date, working_days: Iterable[int], holidays: Iterable[date]) -> None:
        self.working_weekdays = {int(d) for d in working_days}
        if not self.working_weekdays:
            raise ValueError("at least one working weekday is required")
        self.holidays = set(holidays)
        self.start = self.next_working(start)
        self._days: list[date] = [self.start]  # index -> date, grown on demand
        self._before: list[date] = []  # negative indexes: -1 -> _before[0], ...

    # ----------------------------------------------------------- predicates
    def is_working(self, d: date) -> bool:
        return d.isoweekday() in self.working_weekdays and d not in self.holidays

    def next_working(self, d: date) -> date:
        while not self.is_working(d):
            d += timedelta(days=1)
        return d

    def prev_working(self, d: date) -> date:
        while not self.is_working(d):
            d -= timedelta(days=1)
        return d

    # ------------------------------------------------------- index <-> date
    def day(self, index: int) -> date:
        """Date of the working day at `index` (0 = project start). Negative allowed."""
        if index >= 0:
            while len(self._days) <= index:
                self._days.append(self.next_working(self._days[-1] + timedelta(days=1)))
            return self._days[index]
        k = -index - 1
        while len(self._before) <= k:
            last = self._before[-1] if self._before else self.start
            self._before.append(self.prev_working(last - timedelta(days=1)))
        return self._before[k]

    def index_of(self, d: date) -> int:
        """Index of the first working day on/after `d`."""
        d = self.next_working(d)
        if d >= self.start:
            i = 0
            while True:
                if self.day(i) >= d:
                    return i
                i += 1
        i = -1
        while True:
            if self.day(i) <= d:
                return i
            i -= 1

    def add_working_days(self, d: date, n: int) -> date:
        return self.day(self.index_of(d) + n)

    def count_working_days(self, a: date, b: date) -> int:
        """Number of working days in the inclusive range [a, b]."""
        if b < a:
            return 0
        n = 0
        d = a
        while d <= b:
            if self.is_working(d):
                n += 1
            d += timedelta(days=1)
        return n
