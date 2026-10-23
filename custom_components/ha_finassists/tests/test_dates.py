import importlib.util
import unittest
from datetime import date
from pathlib import Path

_dates_path = Path(__file__).resolve().parents[1] / "dates.py"
_dates_spec = importlib.util.spec_from_file_location("fin_assist_dates", _dates_path)
_dates_module = importlib.util.module_from_spec(_dates_spec)
_dates_spec.loader.exec_module(_dates_module)
last_occurrence_date = _dates_module.last_occurrence_date


class LastOccurrenceDateTests(unittest.TestCase):
    def test_daily_and_weekly_recurrences(self):
        self.assertEqual(
            last_occurrence_date(
                {"startDate": "2024-01-01", "frequency": "daily", "interval": 2, "occurrenceLimit": 4}
            ),
            date(2024, 1, 7),
        )
        self.assertEqual(
            last_occurrence_date(
                {"startDate": "2024-01-01", "frequency": "weekly", "interval": 2, "occurrenceLimit": 3}
            ),
            date(2024, 1, 29),
        )

    def test_monthly_and_yearly_recurrences_clamp_month_end(self):
        self.assertEqual(
            last_occurrence_date(
                {"startDate": "2024-01-31", "frequency": "monthly", "occurrenceLimit": 2}
            ),
            date(2024, 2, 29),
        )
        self.assertEqual(
            last_occurrence_date(
                {"startDate": "2024-02-29", "frequency": "yearly", "occurrenceLimit": 2}
            ),
            date(2025, 2, 28),
        )

    def test_one_time_schedule_uses_start_date(self):
        self.assertEqual(
            last_occurrence_date({"startDate": "2024-03-15", "frequency": "one_time"}),
            date(2024, 3, 15),
        )

    def test_unknown_or_unbounded_schedule_has_no_calculated_end(self):
        self.assertIsNone(last_occurrence_date({"startDate": "2024-01-01", "frequency": "monthly"}))
        self.assertIsNone(
            last_occurrence_date(
                {"startDate": "2024-01-01", "frequency": "biweekly", "occurrenceLimit": 3}
            )
        )
        self.assertIsNone(
            last_occurrence_date(
                {"startDate": "invalid", "frequency": "daily", "occurrenceLimit": 3}
            )
        )


if __name__ == "__main__":
    unittest.main()
