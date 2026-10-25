"""Supervisor discovery config flow for Fin Assist."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.service_info.hassio import HassioServiceInfo

from .api import FinAssistApi, FinAssistApiError
from .const import CONF_BASE_URL, CONF_SYSTEM_TOKEN, DOMAIN, NAME

CONF_BOOTSTRAP_CAPABILITY = "bootstrapCapability"


class FinAssistConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Set up the integration from user-confirmed Supervisor discovery."""

    VERSION = 1

    def __init__(self) -> None:
        self._base_url: str | None = None
        self._bootstrap_capability: str | None = None
        self._discovery_name = NAME
        self._reauth_entry: config_entries.ConfigEntry | None = None
        self._errors: dict[str, str] = {}

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> dict[str, Any]:
        """Require the supported Supervisor discovery flow."""
        return self.async_abort(reason="supervisor_discovery_required")

    async def async_step_hassio(
        self, discovery_info: HassioServiceInfo
    ) -> dict[str, Any]:
        """Validate discovery data and wait for explicit user confirmation."""
        config = discovery_info.config
        if not isinstance(config, dict):
            return self.async_abort(reason="invalid_discovery_data")
        capability = config.get(CONF_BOOTSTRAP_CAPABILITY)
        if not isinstance(capability, str) or not capability.strip():
            return self.async_abort(reason="invalid_discovery_data")

        slug = discovery_info.slug
        if not isinstance(slug, str):
            return self.async_abort(reason="invalid_discovery_data")
        slug = slug.strip().lower()
        if not slug or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789_-" for char in slug):
            return self.async_abort(reason="invalid_discovery_data")
        self._base_url = f"http://{slug.replace('_', '-')}:8099/api/v1"

        await self.async_set_unique_id(slug)
        self._abort_if_unique_id_configured()
        self._bootstrap_capability = capability.strip()
        self._discovery_name = discovery_info.name or NAME
        return await self.async_step_confirm()

    async def async_step_confirm(
        self, user_input: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Exchange the single-use capability only after user confirmation."""
        if user_input is None:
            return self.async_show_form(step_id="confirm", data_schema=vol.Schema({}))
        if not self._base_url or not self._bootstrap_capability:
            return self.async_abort(reason="invalid_discovery_data")

        try:
            identity = await self._exchange(self._bootstrap_capability)
            await self._async_validate_identity(identity)
        except FinAssistApiError as err:
            self._errors = {"base": "invalid_auth" if err.status == 401 else "cannot_connect"}
            return self.async_show_form(step_id="confirm", data_schema=vol.Schema({}), errors=self._errors)

        return self.async_create_entry(
            title=self._discovery_name,
            data={CONF_BASE_URL: self._base_url, **identity},
        )

    async def _exchange(self, capability: str) -> dict[str, str]:
        """Redeem the one-time capability provided by Supervisor discovery."""
        api = FinAssistApi(self._base_url or "", "", async_get_clientsession(self.hass))
        return await api.async_exchange_bootstrap_capability(capability)

    async def _async_validate_identity(self, identity: dict[str, str]) -> None:
        """Verify access and revoke a newly provisioned identity on failure."""
        await _async_validate_system_identity(self.hass, self._base_url or "", identity)

    async def async_step_reauth(self, entry_data: dict[str, Any]) -> dict[str, Any]:
        """Offer authenticated credential rotation for the existing entry."""
        self._reauth_entry = self.hass.config_entries.async_get_entry(self.context["entry_id"])
        if self._reauth_entry is None:
            return self.async_abort(reason="reauth_entry_not_found")
        self._base_url = self._reauth_entry.data[CONF_BASE_URL]
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(
        self, user_input: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Rotate with the current credential and update the entry after validation."""
        if user_input is not None and self._reauth_entry is not None:
            current_api = FinAssistApi(
                self._base_url or "",
                self._reauth_entry.data[CONF_SYSTEM_TOKEN],
                async_get_clientsession(self.hass),
            )
            try:
                identity = await current_api.async_rotate_system_credential()
            except FinAssistApiError as err:
                self._errors = {"base": "invalid_auth" if err.status == 401 else "cannot_connect"}
            else:
                self.hass.config_entries.async_update_entry(
                    self._reauth_entry,
                    data={**self._reauth_entry.data, **identity},
                )
                await self.hass.config_entries.async_reload(self._reauth_entry.entry_id)
                return self.async_abort(reason="reauth_successful")
        return self.async_show_form(
            step_id="reauth_confirm", data_schema=vol.Schema({}), errors=self._errors
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry) -> "FinAssistOptionsFlow":
        return FinAssistOptionsFlow(config_entry)


class FinAssistOptionsFlow(config_entries.OptionsFlow):
    """Offer an explicit credential rotation for an existing entry."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self.config_entry = config_entry

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> dict[str, Any]:
        if user_input is not None:
            api = FinAssistApi(
                self.config_entry.data[CONF_BASE_URL],
                self.config_entry.data[CONF_SYSTEM_TOKEN],
                async_get_clientsession(self.hass),
            )
            try:
                identity = await api.async_rotate_system_credential()
            except FinAssistApiError as err:
                return self.async_show_form(
                    step_id="init",
                    data_schema=vol.Schema({}),
                    errors={"base": "invalid_auth" if err.status == 401 else "cannot_connect"},
                )
            self.hass.config_entries.async_update_entry(
                self.config_entry, data={**self.config_entry.data, **identity}
            )
            await self.hass.config_entries.async_reload(self.config_entry.entry_id)
            return self.async_create_entry(title="", data={})
        return self.async_show_form(step_id="init", data_schema=vol.Schema({}))


async def _async_validate_system_identity(
    hass: Any, base_url: str, identity: dict[str, str]
) -> None:
    """Verify new credentials and revoke them if initial validation fails."""
    api = FinAssistApi(base_url, identity[CONF_SYSTEM_TOKEN], async_get_clientsession(hass))
    try:
        await api.async_page("transactions")
    except FinAssistApiError:
        try:
            await api.async_revoke_system_credential()
        except FinAssistApiError:
            pass
        raise
