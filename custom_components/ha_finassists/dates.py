"""Date calculations for schedule entities."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any


def last_occurrence_date(schedule: dict[str, Any]) -> date | None:
    """Calculate the last date for a finite schedule when its limit is known."""
    try:
        start = date.fromisoformat(schedule["startDate"])
        frequency = schedule["frequency"]
        interval = max(1, int(schedule.get("interval", 1)))
    except (KeyError, TypeError, ValueError):
        return None
    if frequency == "one_time":
        return start
    try:
        count = int(schedule["occurrenceLimit"])
    except (KeyError, TypeError, ValueError):
        return None
    if count < 1:
        return None
    if frequency in ("daily", "weekly"):
        days = interval * (1 if frequency == "daily" else 7) * (count - 1)
        return start + timedelta(days=days)
    if frequency in ("monthly", "quarterly", "yearly"):
        months = interval * {"monthly": 1, "quarterly": 3, "yearly": 12}[frequency]
        total_month = start.year * 12 + (start.month - 1) + months * (count - 1)
        year, month = divmod(total_month, 12)
        month += 1
        next_month = date(year + (month == 12), 1 if month == 12 else month + 1, 1)
        month_end = next_month - timedelta(days=1)
        return date(year, month, min(start.day, month_end.day))
    return None
