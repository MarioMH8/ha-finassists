"""Fin Assist Home Assistant integration."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

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
SERVICE_SET_SCHEDULE_STATUS = "set_schedule_status"

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
            previous = coordinator.data.get("upcoming_schedules", []) if coordinator.data else []
            data = await api.async_fetch_dashboard(previous)
            if data["schedule_refresh_failed"]:
                _LOGGER.warning("Fin Assist schedule refresh failed; retaining the prior schedule data")
            return data
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


def _async_register_services(hass: HomeAssistant) -> None:
    """Register documented refresh and schedule-status services once."""
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
    if not hass.services.has_service(DOMAIN, SERVICE_SET_SCHEDULE_STATUS):
        async def async_set_schedule_status(call: ServiceCall) -> None:
            entry_id = call.data.get("entry_id")
            runtime = hass.data.get(DOMAIN, {}).get(entry_id)
            if runtime is None:
                raise ValueError("Unknown Fin Assist config entry")
            try:
                await runtime["api"].async_set_schedule_status(
                    call.data["book_id"], call.data["schedule_id"], call.data["status"]
                )
                await runtime["coordinator"].async_request_refresh()
            except FinAssistApiError as err:
                raise ValueError(str(err)) from err

        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_SCHEDULE_STATUS,
            async_set_schedule_status,
            schema=vol.Schema(
                {
                    vol.Required("entry_id"): str,
                    vol.Required("book_id"): str,
                    vol.Required("schedule_id"): str,
                    vol.Required("status"): vol.In(("active", "paused", "canceled")),
                }
            ),
        )
