"""Report period windows.

Each period decides both the range to cover and how to bucket it — and the
previous window has to be the same length so comparisons are like-for-like.
"""

from datetime import date, datetime, time, timedelta, timezone

from app.api.v1.endpoints.reports import _period_bounds


def today_utc() -> datetime:
    return datetime.combine(date.today(), time.min, tzinfo=timezone.utc)


class TestPeriodBounds:
    def test_daily_covers_today_only(self):
        start, end, prev_start, trunc, label = _period_bounds("daily")

        assert start == today_utc()
        assert end == today_utc() + timedelta(days=1)
        assert trunc == "hour"

    def test_daily_compares_against_yesterday(self):
        start, _end, prev_start, _trunc, _label = _period_bounds("daily")

        # The previous window runs from prev_start up to start — one day.
        assert start - prev_start == timedelta(days=1)

    def test_weekly_covers_seven_days(self):
        start, end, _prev, trunc, label = _period_bounds("weekly")

        assert start == today_utc() - timedelta(days=6)
        assert end == today_utc() + timedelta(days=1)
        assert trunc == "day"
        assert label == "Last 7 days"

    def test_weekly_compares_against_the_previous_seven_days(self):
        start, _end, prev_start, _trunc, _label = _period_bounds("weekly")

        assert start - prev_start == timedelta(days=7)

    def test_monthly_starts_on_the_first(self):
        start, _end, _prev, trunc, _label = _period_bounds("monthly")

        assert start.day == 1
        assert start.month == date.today().month
        assert trunc == "day"

    def test_monthly_compares_against_the_previous_month(self):
        start, _end, prev_start, _trunc, _label = _period_bounds("monthly")

        # relativedelta handles month lengths properly — a month before
        # 1 March is 1 February, not "28 days earlier".
        assert prev_start.day == 1
        expected_month = 12 if start.month == 1 else start.month - 1
        assert prev_start.month == expected_month

    def test_yearly_covers_twelve_months_and_buckets_by_month(self):
        start, _end, _prev, trunc, label = _period_bounds("yearly")

        assert start.day == 1
        assert trunc == "month"
        assert label == "Last 12 months"

    def test_yearly_compares_against_the_twelve_months_before(self):
        start, _end, prev_start, _trunc, _label = _period_bounds("yearly")

        assert prev_start.day == 1
        assert prev_start.year == start.year - 1
        assert prev_start.month == start.month

    def test_every_period_ends_after_it_starts(self):
        for period in ("daily", "weekly", "monthly", "yearly"):
            start, end, prev_start, _trunc, _label = _period_bounds(period)

            assert end > start, f"{period}: end should be after start"
            assert prev_start < start, f"{period}: previous window should precede this one"

    def test_every_period_returns_a_label(self):
        for period in ("daily", "weekly", "monthly", "yearly"):
            _start, _end, _prev, _trunc, label = _period_bounds(period)

            assert label, f"{period}: needs a human-readable label"

    def test_bucketing_matches_the_range_length(self):
        """A day is bucketed by hour, a year by month — anything else would
        produce either a single bar or hundreds of them."""
        expected = {
            "daily": "hour",
            "weekly": "day",
            "monthly": "day",
            "yearly": "month",
        }

        for period, trunc in expected.items():
            _start, _end, _prev, actual, _label = _period_bounds(period)

            assert actual == trunc, f"{period}: expected {trunc}, got {actual}"