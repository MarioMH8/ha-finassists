"""Monthly income and expense sensors."""

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


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: Any) -> None:
    """Create the income and expense sensors for the entry."""
    coordinator = hass.data[DOMAIN][entry.entry_id]["coordinator"]
    async_add_entities(
        FinAssistMonthlyTotalSensor(coordinator, entry, *sensor) for sensor in SENSORS
    )


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
        return {
            "integration_entry_id": self._entry_id,
            "kind": self._kind,
            "month": self.coordinator.data.get("month"),
        }
