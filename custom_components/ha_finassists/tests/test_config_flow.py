"""Focused config-flow tests with a small Home Assistant API test double."""

from __future__ import annotations

import asyncio
import importlib
import json
import sys
import types
import unittest
from types import SimpleNamespace
from typing import Any


class _Schema:
    def __init__(self, schema: dict[str, Any]) -> None:
        self.schema = schema


class _ConfigFlow:
    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__()
        cls.domain = kwargs.get("domain")

    def __init__(self) -> None:
        self.hass: Any = None
        self.context: dict[str, Any] = {}

    async def async_set_unique_id(self, unique_id: str) -> None:
        self.unique_id = unique_id

    def _abort_if_unique_id_configured(self) -> None:
        return

    def async_abort(self, *, reason: str) -> dict[str, Any]:
        return {"type": "abort", "reason": reason}

    def async_show_form(self, *, step_id: str, data_schema: Any, errors: Any = None) -> dict[str, Any]:
        return {"type": "form", "step_id": step_id, "errors": errors or {}}

    def async_create_entry(self, *, title: str, data: dict[str, Any]) -> dict[str, Any]:
        return {"type": "create_entry", "title": title, "data": data}


class _OptionsFlow(_ConfigFlow):
    pass


class _Invalid(Exception):
    pass


def _install_home_assistant_stubs() -> None:
    ha = types.ModuleType("homeassistant")
    config_entries = types.ModuleType("homeassistant.config_entries")
    config_entries.ConfigFlow = _ConfigFlow
    config_entries.OptionsFlow = _OptionsFlow
    config_entries.ConfigEntry = type("ConfigEntry", (), {})
    core = types.ModuleType("homeassistant.core")
    core.callback = lambda function: function
    core.HomeAssistant = type("HomeAssistant", (), {})
    core.ServiceCall = type("ServiceCall", (), {})
    helpers = types.ModuleType("homeassistant.helpers")
    aiohttp_client = types.ModuleType("homeassistant.helpers.aiohttp_client")
    aiohttp_client.async_get_clientsession = lambda hass: hass.session
    service_info = types.ModuleType("homeassistant.helpers.service_info")
    hassio = types.ModuleType("homeassistant.helpers.service_info.hassio")
    hassio.HassioServiceInfo = type("HassioServiceInfo", (), {})
    update_coordinator = types.ModuleType("homeassistant.helpers.update_coordinator")
    update_coordinator.DataUpdateCoordinator = type("DataUpdateCoordinator", (), {})
    update_coordinator.CoordinatorEntity = type(
        "CoordinatorEntity",
        (),
        {"__init__": lambda self, coordinator: setattr(self, "coordinator", coordinator)},
    )
    update_coordinator.UpdateFailed = type("UpdateFailed", (Exception,), {})
    entity = types.ModuleType("homeassistant.helpers.entity")
    entity.DeviceInfo = lambda **kwargs: kwargs
    device_registry = types.ModuleType("homeassistant.helpers.device_registry")
    components = types.ModuleType("homeassistant.components")
    sensor = types.ModuleType("homeassistant.components.sensor")
    sensor.SensorDeviceClass = SimpleNamespace(MONETARY="monetary")
    sensor.SensorEntity = type("SensorEntity", (), {})
    sensor.SensorStateClass = SimpleNamespace(MEASUREMENT="measurement")
    components.sensor = sensor
    http = types.ModuleType("homeassistant.components.http")
    http.StaticPathConfig = type("StaticPathConfig", (), {})
    exceptions = types.ModuleType("homeassistant.exceptions")
    exceptions.ConfigEntryAuthFailed = type("ConfigEntryAuthFailed", (Exception,), {})
    helpers.aiohttp_client = aiohttp_client
    helpers.service_info = service_info
    service_info.hassio = hassio
    helpers.update_coordinator = update_coordinator
    helpers.device_registry = device_registry
    components.http = http
    ha.config_entries = config_entries
    ha.core = core
    ha.helpers = helpers
    ha.components = components
    modules = {
        "homeassistant": ha,
        "homeassistant.config_entries": config_entries,
        "homeassistant.core": core,
        "homeassistant.helpers": helpers,
        "homeassistant.helpers.aiohttp_client": aiohttp_client,
        "homeassistant.helpers.service_info": service_info,
        "homeassistant.helpers.service_info.hassio": hassio,
        "homeassistant.helpers.update_coordinator": update_coordinator,
        "homeassistant.helpers.entity": entity,
        "homeassistant.helpers.device_registry": device_registry,
        "homeassistant.components": components,
        "homeassistant.components.sensor": sensor,
        "homeassistant.components.http": http,
        "homeassistant.exceptions": exceptions,
    }
    sys.modules.update(modules)

    babel = types.ModuleType("babel")
    babel_numbers = types.ModuleType("babel.numbers")
    babel_numbers.get_currency_precision = lambda currency: 2
    babel.numbers = babel_numbers
    sys.modules.update({"babel": babel, "babel.numbers": babel_numbers})

    voluptuous = types.ModuleType("voluptuous")
    voluptuous.Schema = _Schema
    voluptuous.Invalid = _Invalid
    sys.modules["voluptuous"] = voluptuous

    aiohttp = types.ModuleType("aiohttp")
    aiohttp.ClientError = type("ClientError", (Exception,), {})
    aiohttp.ClientSession = type("ClientSession", (), {})
    aiohttp.ClientTimeout = lambda total: SimpleNamespace(total=total)
    sys.modules["aiohttp"] = aiohttp


_install_home_assistant_stubs()

from custom_components.ha_finassists import config_flow  # noqa: E402
from custom_components.ha_finassists.api import FinAssistApi, FinAssistApiError  # noqa: E402
from custom_components.ha_finassists.sensor import FinAssistUpcomingSchedulesSensor  # noqa: E402


class _FlowApi:
    instances: list["_FlowApi"] = []
    exchange_error: FinAssistApiError | None = None
    validation_error: FinAssistApiError | None = None

    def __init__(self, base_url: str, token: str, session: Any) -> None:
        self.base_url = base_url
        self.token = token
        self.calls: list[tuple[str, Any]] = []
        self.__class__.instances.append(self)

    async def async_exchange_bootstrap_capability(self, capability: str) -> dict[str, str]:
        self.calls.append(("exchange", capability))
        if self.exchange_error:
            raise self.exchange_error
        return {"credential_id": "credential-1", "system_token": "long-lived-secret"}

    async def async_page(self, path: str) -> list[dict[str, Any]]:
        self.calls.append(("page", path))
        if self.validation_error:
            raise self.validation_error
        return []

    async def async_revoke_system_credential(self) -> None:
        self.calls.append(("revoke", None))

    async def async_rotate_system_credential(self) -> dict[str, str]:
        self.calls.append(("rotate", None))
        return {"credential_id": "credential-2", "system_token": "rotated-secret"}


class ConfigFlowTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        _FlowApi.instances.clear()
        _FlowApi.exchange_error = None
        _FlowApi.validation_error = None
        config_flow.FinAssistApi = _FlowApi

    def _flow(self) -> Any:
        flow = config_flow.FinAssistConfigFlow()
        flow.hass = SimpleNamespace(session=object())
        return flow

    def _discovery(self, config: Any, slug: Any = "ha-finassists") -> Any:
        return SimpleNamespace(config=config, slug=slug, name="Fin Assist Add-on")

    async def test_manual_setup_and_invalid_discovery_are_rejected(self) -> None:
        flow = self._flow()
        self.assertEqual((await flow.async_step_user())["reason"], "supervisor_discovery_required")
        result = await flow.async_step_hassio(self._discovery({"baseUrl": "http://service/api/v1"}))
        self.assertEqual(result["reason"], "invalid_discovery_data")
        self.assertEqual(_FlowApi.instances, [])

    async def test_discovery_waits_for_confirmation_before_exchange(self) -> None:
        flow = self._flow()
        result = await flow.async_step_hassio(
            self._discovery({"baseUrl": "http://ha-finassists:8099/api/v1", "bootstrapCapability": "once"})
        )
        self.assertEqual((result["type"], result["step_id"]), ("form", "confirm"))
        self.assertEqual(_FlowApi.instances, [])

        result = await flow.async_step_confirm({})
        self.assertEqual(result["type"], "create_entry")
        self.assertEqual(result["data"]["system_token"], "long-lived-secret")
        self.assertNotIn("bootstrapCapability", result["data"])
        self.assertEqual(_FlowApi.instances[0].calls, [("exchange", "once")])
        self.assertEqual(_FlowApi.instances[1].calls, [("page", "books")])

    async def test_exchange_error_is_shown_without_creating_entry(self) -> None:
        _FlowApi.exchange_error = FinAssistApiError("rejected", 401)
        flow = self._flow()
        await flow.async_step_hassio(
            self._discovery({"baseUrl": "http://ha-finassists/api/v1", "bootstrapCapability": "bad"})
        )
        result = await flow.async_step_confirm({})
        self.assertEqual(result["type"], "form")
        self.assertEqual(result["errors"], {"base": "invalid_auth"})

    async def test_validation_error_revokes_new_credential(self) -> None:
        _FlowApi.validation_error = FinAssistApiError("unreachable")
        flow = self._flow()
        await flow.async_step_hassio(
            self._discovery({"baseUrl": "http://ha-finassists/api/v1", "bootstrapCapability": "once"})
        )
        result = await flow.async_step_confirm({})
        self.assertEqual(result["errors"], {"base": "cannot_connect"})
        self.assertEqual(_FlowApi.instances[1].calls, [("page", "books"), ("revoke", None)])

    async def test_discovery_uses_validated_slug_for_internal_api_host(self) -> None:
        flow = self._flow()
        bad_slug = await flow.async_step_hassio(
            self._discovery({"bootstrapCapability": "once"}, slug="invalid slug")
        )
        self.assertEqual(bad_slug["reason"], "invalid_discovery_data")

        result = await flow.async_step_hassio(
            self._discovery(
                {
                    "baseUrl": "https://attacker.example/collect",
                    "bootstrapCapability": "once",
                },
                slug="Local_ha_finassists",
            )
        )
        self.assertEqual((result["type"], result["step_id"]), ("form", "confirm"))
        self.assertEqual(flow._base_url, "http://local-ha-finassists:8099/api/v1")

    async def test_reauth_rotates_using_persisted_credential(self) -> None:
        entry = SimpleNamespace(
            data={"base_url": "http://fin-assist/api/v1", "system_token": "old", "credential_id": "old-id"},
            entry_id="entry-1",
        )
        hass = SimpleNamespace(
            session=object(),
            config_entries=SimpleNamespace(
                async_get_entry=lambda entry_id: entry,
                async_update_entry=lambda config_entry, data: setattr(config_entry, "data", data),
                async_reload=lambda entry_id: asyncio.sleep(0),
            ),
        )
        flow = self._flow()
        flow.hass = hass
        flow.context = {"entry_id": "entry-1"}
        await flow.async_step_reauth({})
        result = await flow.async_step_reauth_confirm({})
        self.assertEqual(result["reason"], "reauth_successful")
        self.assertEqual(entry.data["system_token"], "rotated-secret")
        self.assertEqual(_FlowApi.instances[0].token, "old")
        self.assertIn(("rotate", None), _FlowApi.instances[0].calls)

    async def test_options_rotation_updates_config_entry(self) -> None:
        entry = SimpleNamespace(
            data={"base_url": "http://fin-assist/api/v1", "system_token": "old", "credential_id": "old-id"},
            entry_id="entry-1",
        )
        hass = SimpleNamespace(
            session=object(),
            config_entries=SimpleNamespace(
                async_update_entry=lambda config_entry, data: setattr(config_entry, "data", data),
                async_reload=lambda entry_id: asyncio.sleep(0),
            ),
        )
        options = config_flow.FinAssistOptionsFlow(entry)
        options.hass = hass
        result = await options.async_step_init({})
        self.assertEqual(result["type"], "create_entry")
        self.assertEqual(entry.data["system_token"], "rotated-secret")
        self.assertIn(("rotate", None), _FlowApi.instances[0].calls)


class SensorAttributeTests(unittest.TestCase):
    def test_schedule_sensor_reports_stale_schedule_refresh(self) -> None:
        coordinator = SimpleNamespace(
            data={"schedule_refresh_failed": True, "upcoming_schedules": []}
        )
        entry = SimpleNamespace(entry_id="entry-1")
        sensor = FinAssistUpcomingSchedulesSensor(
            coordinator, entry, {"id": "book-1", "name": "Household"}
        )

        self.assertTrue(sensor.extra_state_attributes["schedule_refresh_failed"])


class _Response:
    def __init__(
        self, status: int = 200, payload: Any = None, malformed_json: bool = False
    ) -> None:
        self.status = status
        self.content_type = "application/json"
        self.payload = payload or {}
        self.malformed_json = malformed_json

    async def json(self) -> Any:
        if self.malformed_json:
            raise json.JSONDecodeError("invalid JSON", "{", 1)
        return self.payload


class _RequestContext:
    def __init__(self, response: _Response) -> None:
        self.response = response

    async def __aenter__(self) -> _Response:
        return self.response

    async def __aexit__(self, *args: Any) -> None:
        return None


class _Session:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def request(self, method: str, url: str, **kwargs: Any) -> _RequestContext:
        self.calls.append({"method": method, "url": url, **kwargs})
        payload = {"id": "credential-1", "credential": "long-lived-secret"}
        status = 204 if method == "DELETE" else 200
        return _RequestContext(_Response(status, payload))


class CredentialLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_malformed_json_is_translated_to_api_error(self) -> None:
        session = _Session()
        session.request = lambda method, url, **kwargs: _RequestContext(
            _Response(malformed_json=True)
        )

        with self.assertRaisesRegex(FinAssistApiError, "malformed JSON"):
            await FinAssistApi("http://fin-assist/api/v1", "", session).async_request(
                "GET", "books"
            )

    async def test_exchange_has_no_auth_and_rotation_and_revoke_use_bearer(self) -> None:
        session = _Session()
        unauthenticated = FinAssistApi("http://fin-assist/api/v1", "", session)
        identity = await unauthenticated.async_exchange_bootstrap_capability("one-time")
        self.assertEqual(identity["system_token"], "long-lived-secret")
        exchange = session.calls[-1]
        self.assertEqual(exchange["method"], "POST")
        self.assertNotIn("Authorization", exchange["headers"])
        self.assertEqual(exchange["json"], {"bootstrapCapability": "one-time"})

        authenticated = FinAssistApi("http://fin-assist/api/v1", "system-secret", session)
        await authenticated.async_rotate_system_credential()
        self.assertEqual(session.calls[-1]["method"], "PUT")
        self.assertEqual(session.calls[-1]["headers"], {"Authorization": "Bearer system-secret"})
        await authenticated.async_revoke_system_credential()
        self.assertEqual(session.calls[-1]["method"], "DELETE")
        self.assertEqual(session.calls[-1]["headers"], {"Authorization": "Bearer system-secret"})

    async def test_entry_removal_revokes_but_unload_does_not(self) -> None:
        integration = importlib.import_module("custom_components.ha_finassists")
        session = _Session()
        entry = SimpleNamespace(
            data={"base_url": "http://fin-assist/api/v1", "system_token": "system-secret"},
            entry_id="entry-1",
        )
        hass = SimpleNamespace(
            session=session,
            data={"ha_finassists": {"entry-1": {"runtime": True}}},
            config_entries=SimpleNamespace(async_unload_platforms=lambda entry, platforms: asyncio.sleep(0, result=True)),
        )
        self.assertTrue(await integration.async_unload_entry(hass, entry))
        self.assertEqual(session.calls, [])
        await integration.async_remove_entry(hass, entry)
        self.assertEqual(session.calls[-1]["method"], "DELETE")
        self.assertNotIn("entry-1", hass.data["ha_finassists"])


if __name__ == "__main__":
    unittest.main()
