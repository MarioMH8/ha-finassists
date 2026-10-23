"""Account and upcoming-schedule sensors."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from babel.numbers import get_currency_precision
from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: Any) -> None:
    """Create account sensors and one finite-schedule sensor per book."""
    runtime = hass.data[DOMAIN][entry.entry_id]
    coordinator = runtime["coordinator"]
    known_accounts: set[str] = set()
    known_books: set[str] = set()

    @callback
    def add_new_entities() -> None:
        entities: list[SensorEntity] = []
        for book in coordinator.data.get("books", []):
            book_id = str(book.get("id"))
            if book_id not in known_books:
                known_books.add(book_id)
                entities.append(FinAssistUpcomingSchedulesSensor(coordinator, entry, book))
            for account in book.get("accounts", []):
                account_id = str(account.get("id"))
                if account_id not in known_accounts:
                    known_accounts.add(account_id)
                    entities.append(FinAssistBalanceSensor(coordinator, entry, book, account))
        if entities:
            async_add_entities(entities)

    add_new_entities()
    entry.async_on_unload(coordinator.async_add_listener(add_new_entities))


class FinAssistBalanceSensor(CoordinatorEntity, SensorEntity):
    """Current account balance with posted/reconciled balance attributes."""

    _attr_device_class = SensorDeviceClass.MONETARY
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator: Any, entry: ConfigEntry, book: dict[str, Any], account: dict[str, Any]) -> None:
        super().__init__(coordinator)
        self._entry = entry
        self._book = book
        self._account = account
        self._currency = str(book.get("currencyCode", "USD"))
        self._fraction_digits = get_currency_precision(self._currency)
        self._scale = Decimal(10) ** self._fraction_digits
        self._attr_unique_id = f"{entry.entry_id}_{account['id']}_balance"
        self._attr_name = f"{account['name']} balance"
        self._attr_native_unit_of_measurement = self._currency
        self._attr_extra_state_attributes = {
            "integration_entry_id": entry.entry_id,
            "book_id": book["id"],
            "book_name": book.get("name"),
            "account_id": account["id"],
            "account_name": account.get("name"),
            "account_kind": account.get("kind"),
            "opening_balance_minor": account.get("openingBalanceMinor"),
        }
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, f"{entry.entry_id}_{account['id']}")},
            name=f"{book.get('name')} — {account.get('name')}",
            manufacturer="Fin Assist",
            model=str(account.get("kind", "account")),
        )

    @property
    def available(self) -> bool:
        return super().available and self._balance() is not None

    @property
    def native_value(self) -> Decimal | None:
        value = self._balance()
        if value is None:
            return None
        return Decimal(str(value["totalMinor"])) / self._scale

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        attributes = dict(self._attr_extra_state_attributes)
        balance = self._balance()
        if balance is not None:
            attributes.update(
                {
                    "posted_balance": Decimal(str(balance["postedMinor"])) / self._scale,
                    "reconciled_balance": Decimal(str(balance["reconciledMinor"])) / self._scale,
                    "total_minor": balance["totalMinor"],
                    "posted_minor": balance["postedMinor"],
                    "reconciled_minor": balance["reconciledMinor"],
                }
            )
        return attributes

    def _balance(self) -> dict[str, Any] | None:
        """Return the latest matching balance DTO."""
        for book in self.coordinator.data.get("books", []):
            if book.get("id") == self._book.get("id"):
                for account in book.get("accounts", []):
                    if account.get("id") == self._account.get("id"):
                        balance = account.get("balance")
                        return balance if isinstance(balance, dict) else None
        return None


class FinAssistUpcomingSchedulesSensor(CoordinatorEntity, SensorEntity):
    """Number of active or paused finite schedules ending within the next 30 days."""

    _attr_icon = "mdi:calendar-clock"
    _attr_native_unit_of_measurement = "schedules"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator: Any, entry: ConfigEntry, book: dict[str, Any]) -> None:
        super().__init__(coordinator)
        self._book_id = book["id"]
        self._entry_id = entry.entry_id
        self._attr_unique_id = f"{entry.entry_id}_{book['id']}_upcoming_schedules"
        self._attr_name = f"{book.get('name')} schedules ending soon"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, f"{entry.entry_id}_{book['id']}")},
            name=str(book.get("name")),
            manufacturer="Fin Assist",
            model="book",
            via_device=(DOMAIN, entry.entry_id),
        )

    @property
    def native_value(self) -> int:
        return sum(
            1
            for schedule in self.coordinator.data.get("upcoming_schedules", [])
            if schedule.get("bookId") == self._book_id
        )

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            "integration_entry_id": self._entry_id,
            "schedules": [
                schedule
                for schedule in self.coordinator.data.get("upcoming_schedules", [])
                if schedule.get("bookId") == self._book_id
            ]
        }
