"""Fin Assist Home Assistant integration."""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from babel.numbers import get_currency_precision
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.components.http import StaticPathConfig
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.exceptions import ConfigEntryAuthFailed

from .api import FinAssistApi, FinAssistApiError
from .const import CONF_BASE_URL, CONF_SYSTEM_TOKEN, DOMAIN, PLATFORMS, UPDATE_INTERVAL

SERVICE_REFRESH = "refresh"
SERVICE_ADD_EXPENSE = "add_expense"
SERVICE_ADD_INCOME = "add_income"
SERVICE_DELETE_TRANSACTION = "delete_transaction"

_LOGGER = logging.getLogger(__name__)


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Best-effort revoke the credential when the user removes the entry."""
    api = FinAssistApi(
        entry.data[CONF_BASE_URL],
        entry.data[CONF_SYSTEM_TOKEN],
        async_get_clientsession(hass),
    )
    try:
        await api.async_revoke_system_credential()
    except FinAssistApiError:
        _LOGGER.warning("Could not revoke Fin Assist system credential during removal")
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Fin Assist from a config entry."""
    session = async_get_clientsession(hass)
    base_url = entry.options.get(CONF_BASE_URL, entry.data[CONF_BASE_URL])
    api = FinAssistApi(base_url, entry.data[CONF_SYSTEM_TOKEN], session)

    async def async_update_data() -> dict[str, Any]:
        try:
            return await api.async_fetch_summary()
        except FinAssistApiError as err:
            if err.status == 401:
                raise ConfigEntryAuthFailed("Fin Assist system credential is no longer valid") from err
            raise UpdateFailed(str(err)) from err

    coordinator = DataUpdateCoordinator(
        hass,
        _LOGGER,
        name=DOMAIN,
        update_method=async_update_data,
        update_interval=UPDATE_INTERVAL,
    )
    await coordinator.async_config_entry_first_refresh()
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {"api": api, "coordinator": coordinator}
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    await _async_register_card(hass)
    _async_register_services(hass)
    entry.async_on_unload(entry.add_update_listener(_async_reload_entry))
    return True


async def _async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload after options change."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload platforms without revoking the entry's reusable credential."""
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    return True


async def _async_register_card(hass: HomeAssistant) -> None:
    """Serve the bundled JS module and register it in Lovelace storage mode."""
    card_path = Path(__file__).parent / "www" / "fin-assist-card.js"
    if not card_path.is_file():
        _LOGGER.warning("Bundled Fin Assist Lovelace card is missing")
        return
    url = f"/{DOMAIN}/fin-assist-card.js"
    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(url, str(card_path), cache_headers=False)]
        )
    except (AttributeError, OSError, ValueError) as err:
        _LOGGER.debug("Could not register Fin Assist card static path: %s", err)
        return
    _LOGGER.info(
        "Fin Assist card is served at %s; add it as a Lovelace module resource "
        "because Home Assistant exposes no supported integration API for resource registration",
        url,
    )


def _to_minor_units(amount: Any, currency_code: str) -> int:
    """Convert a major-unit amount to minor units, rejecting excess precision."""
    try:
        value = Decimal(str(amount))
    except InvalidOperation as err:
        raise ValueError("Amount must be a number") from err
    if not value.is_finite() or value <= 0:
        raise ValueError("Amount must be greater than zero")
    minor = value * (Decimal(10) ** get_currency_precision(currency_code))
    if minor != minor.to_integral_value():
        raise ValueError(f"Amount has more decimal places than {currency_code} allows")
    return int(minor)


async def _async_resolve_category(api: FinAssistApi, kind: str, name: str) -> str:
    """Resolve a category name of the given kind to its identifier."""
    wanted = name.strip().casefold()
    if not wanted:
        raise ValueError("Category must be a non-empty name")
    try:
        categories = await api.async_list_categories(kind)
    except FinAssistApiError as err:
        raise ValueError(str(err)) from err
    for category in categories:
        category_name = category.get("name")
        category_id = category.get("id")
        if (
            isinstance(category_name, str)
            and isinstance(category_id, str)
            and category_name.strip().casefold() == wanted
        ):
            return category_id
    raise ValueError(f"Unknown Fin Assist category: {name}")


def _async_register_services(hass: HomeAssistant) -> None:
    """Register the refresh, add-expense, add-income, and delete-transaction services once."""
    import voluptuous as vol

    if not hass.services.has_service(DOMAIN, SERVICE_REFRESH):
        async def async_refresh(call: ServiceCall) -> None:
            for entry_id, runtime in hass.data.get(DOMAIN, {}).items():
                if call.data.get("entry_id") in (None, entry_id):
                    await runtime["coordinator"].async_request_refresh()

        hass.services.async_register(
            DOMAIN, SERVICE_REFRESH, async_refresh,
            schema=vol.Schema({vol.Optional("entry_id"): str}),
        )

    def make_handler(kind: str):
        async def async_add_transaction(call: ServiceCall) -> None:
            runtime = hass.data.get(DOMAIN, {}).get(call.data["entry_id"])
            if runtime is None:
                raise ValueError("Unknown Fin Assist config entry")
            coordinator = runtime["coordinator"]
            amount_minor = _to_minor_units(call.data["amount"], coordinator.data["currencyCode"])
            category = call.data.get("category")
            category_id = None
            if isinstance(category, str) and category.strip():
                category_id = await _async_resolve_category(runtime["api"], kind, category)
            try:
                await runtime["api"].async_create_transaction(
                    kind,
                    amount_minor,
                    call.data.get("date") or date.today(),
                    call.data.get("description"),
                    category_id,
                )
            except FinAssistApiError as err:
                raise ValueError(str(err)) from err
            await coordinator.async_request_refresh()

        return async_add_transaction

    transaction_schema = vol.Schema(
        {
            vol.Required("entry_id"): str,
            vol.Required("amount"): vol.All(vol.Any(int, float, str), vol.Coerce(str)),
            vol.Optional("date"): vol.Coerce(date.fromisoformat),
            vol.Optional("description"): str,
            vol.Optional("category"): str,
        }
    )
    for service, kind in ((SERVICE_ADD_EXPENSE, "expense"), (SERVICE_ADD_INCOME, "income")):
        if not hass.services.has_service(DOMAIN, service):
            hass.services.async_register(
                DOMAIN, service, make_handler(kind), schema=transaction_schema
            )

    if not hass.services.has_service(DOMAIN, SERVICE_DELETE_TRANSACTION):
        async def async_delete_transaction(call: ServiceCall) -> None:
            runtime = hass.data.get(DOMAIN, {}).get(call.data["entry_id"])
            if runtime is None:
                raise ValueError("Unknown Fin Assist config entry")
            try:
                await runtime["api"].async_delete_transaction(call.data["transaction_id"])
            except FinAssistApiError as err:
                raise ValueError(str(err)) from err
            await runtime["coordinator"].async_request_refresh()

        hass.services.async_register(
            DOMAIN, SERVICE_DELETE_TRANSACTION, async_delete_transaction,
            schema=vol.Schema(
                {
                    vol.Required("entry_id"): str,
                    vol.Required("transaction_id"): str,
                }
            ),
        )
