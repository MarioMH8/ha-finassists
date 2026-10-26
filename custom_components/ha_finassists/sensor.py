"""Monthly totals, scheduled forecast and pending-confirmation sensors."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from babel.numbers import get_currency_precision
from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN

SENSORS = (
    ("income", "Income this month", "income_minor", "mdi:cash-plus"),
    ("expenses", "Expenses this month", "expense_minor", "mdi:cash-minus"),
)

SCHEDULED_SENSORS = (
    (
        "scheduled_income",
        "Scheduled income next 30 days",
        "scheduled_income_minor",
        "income",
        "mdi:cash-plus",
    ),
    (
        "scheduled_expenses",
        "Scheduled expenses next 30 days",
        "scheduled_expense_minor",
        "expense",
        "mdi:cash-minus",
    ),
)


def _currency_code(coordinator: Any) -> str:
    """Resolve the currency reported by the app for this data set."""
    return str(
        coordinator.data.get("scheduled_currency_code")
        or coordinator.data.get("currencyCode")
        or "EUR"
    )


def _scale(currency_code: str) -> Decimal:
    return Decimal(10) ** get_currency_precision(currency_code)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: Any) -> None:
    """Create the recorded and scheduled sensors for the entry."""
    coordinator = hass.data[DOMAIN][entry.entry_id]["coordinator"]
    entities: list[Any] = [
        FinAssistMonthlyTotalSensor(coordinator, entry, *sensor) for sensor in SENSORS
    ]
    entities.extend(
        FinAssistScheduledTotalSensor(coordinator, entry, *sensor) for sensor in SCHEDULED_SENSORS
    )
    entities.append(FinAssistScheduledDueSensor(coordinator, entry))
    async_add_entities(entities)


class FinAssistMonthlyTotalSensor(CoordinatorEntity, SensorEntity):
    """Total of one transaction kind for the current calendar month."""

    _attr_device_class = SensorDeviceClass.MONETARY
    _attr_state_class = SensorStateClass.TOTAL

    def __init__(
        self, coordinator: Any, entry: ConfigEntry, key: str, name: str, data_key: str, icon: str
    ) -> None:
        super().__init__(coordinator)
        self._data_key = data_key
        self._kind = "income" if key == "income" else "expense"
        self._entry_id = entry.entry_id
        self._attr_unique_id = f"{entry.entry_id}_{key}_this_month"
        self._attr_name = name
        self._attr_icon = icon
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="Fin Assist",
            manufacturer="Fin Assist",
        )

    @property
    def native_unit_of_measurement(self) -> str:
        return str(self.coordinator.data["currencyCode"])

    @property
    def native_value(self) -> Decimal:
        scale = Decimal(10) ** get_currency_precision(self.native_unit_of_measurement)
        return Decimal(str(self.coordinator.data[self._data_key])) / scale

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        scale = Decimal(10) ** get_currency_precision(self.native_unit_of_measurement)
        raw_breakdown = self.coordinator.data.get(f"{self._kind}_by_category") or {}
        raw_uncategorized = self.coordinator.data.get(f"uncategorized_{self._kind}_minor") or 0

        return {
            "integration_entry_id": self._entry_id,
            "kind": self._kind,
            "month": self.coordinator.data.get("month"),
            "period": "current_month",
            "scope": "actual",
            "by_category": {
                str(name): float(Decimal(str(amount)) / scale)
                for name, amount in raw_breakdown.items()
            },
            "uncategorized": float(Decimal(str(raw_uncategorized)) / scale),
        }


class FinAssistScheduledTotalSensor(CoordinatorEntity, SensorEntity):
    """Scheduled total of one kind for the next 30 days."""

    _attr_device_class = SensorDeviceClass.MONETARY
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(
        self,
        coordinator: Any,
        entry: ConfigEntry,
        key: str,
        name: str,
        data_key: str,
        kind: str,
        icon: str,
    ) -> None:
        super().__init__(coordinator)
        self._data_key = data_key
        self._kind = kind
        self._entry_id = entry.entry_id
        self._attr_unique_id = f"{entry.entry_id}_{key}_next_30_days"
        self._attr_name = name
        self._attr_icon = icon
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="Fin Assist",
            manufacturer="Fin Assist",
        )

    @property
    def native_unit_of_measurement(self) -> str:
        return _currency_code(self.coordinator)

    @property
    def native_value(self) -> Decimal | None:
        amount = self.coordinator.data.get(self._data_key)
        if amount is None:
            return None
        return Decimal(str(amount)) / _scale(self.native_unit_of_measurement)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        scale = _scale(self.native_unit_of_measurement)
        raw_breakdown = self.coordinator.data.get(f"scheduled_{self._kind}_by_category") or {}
        raw_uncategorized = (
            self.coordinator.data.get(f"scheduled_uncategorized_{self._kind}_minor") or 0
        )
        items = [
            item
            for item in self.coordinator.data.get("scheduled_items") or []
            if item.get("kind") == self._kind
        ]

        attributes: dict[str, Any] = {
            "integration_entry_id": self._entry_id,
            "kind": self._kind,
            "from_date": self.coordinator.data.get("scheduled_from_date"),
            "to_date": self.coordinator.data.get("scheduled_to_date"),
            "period": "next_30_days",
            "scope": "scheduled",
            "by_category": {
                str(name): float(Decimal(str(amount)))
                for name, amount in raw_breakdown.items()
            },
            "uncategorized": float(Decimal(str(raw_uncategorized)) / scale),
            "items": items,
        }
        if self.coordinator.data.get("scheduled_error"):
            attributes["error"] = self.coordinator.data["scheduled_error"]
        return attributes


class FinAssistScheduledDueSensor(CoordinatorEntity, SensorEntity):
    """Count of manual scheduled movements waiting for confirmation."""

    _attr_icon = "mdi:calendar-clock"

    def __init__(self, coordinator: Any, entry: ConfigEntry) -> None:
        super().__init__(coordinator)
        self._entry_id = entry.entry_id
        self._attr_unique_id = f"{entry.entry_id}_scheduled_due"
        self._attr_name = "Scheduled movements due"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="Fin Assist",
            manufacturer="Fin Assist",
        )

    @property
    def native_value(self) -> int | None:
        count = self.coordinator.data.get("scheduled_due_count")
        return int(count) if count is not None else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        attributes: dict[str, Any] = {
            "integration_entry_id": self._entry_id,
            "scope": "scheduled_due",
            "items": self.coordinator.data.get("scheduled_due_items") or [],
        }
        if self.coordinator.data.get("scheduled_error"):
            attributes["error"] = self.coordinator.data["scheduled_error"]
        return attributes
