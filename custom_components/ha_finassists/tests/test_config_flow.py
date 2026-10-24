"""Focused config-flow tests with a small Home Assistant API test double."""

from __future__ import annotations

import asyncio
import importlib
import json
import sys
import types
import unittest
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, Mock, patch


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
    sensor.SensorStateClass = SimpleNamespace(TOTAL="total")
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
    voluptuous.Required = voluptuous.Optional = lambda key: key
    voluptuous.All = voluptuous.Any = lambda *validators: validators
    voluptuous.Coerce = lambda kind: kind
    sys.modules["voluptuous"] = voluptuous

    aiohttp = types.ModuleType("aiohttp")
    aiohttp.ClientError = type("ClientError", (Exception,), {})
    aiohttp.ClientSession = type("ClientSession", (), {})
    aiohttp.ClientTimeout = lambda total: SimpleNamespace(total=total)
    sys.modules["aiohttp"] = aiohttp


_install_home_assistant_stubs()

import custom_components.ha_finassists as integration  # noqa: E402
from custom_components.ha_finassists import config_flow  # noqa: E402
from custom_components.ha_finassists.api import FinAssistApi, FinAssistApiError  # noqa: E402
from custom_components.ha_finassists.sensor import FinAssistMonthlyTotalSensor  # noqa: E402


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
        self.assertEqual(_FlowApi.instances[1].calls, [("page", "transactions")])

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
        self.assertEqual(_FlowApi.instances[1].calls, [("page", "transactions"), ("revoke", None)])

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


class _SetupApi:
    error: FinAssistApiError | None = None
    instances: list["_SetupApi"] = []

    def __init__(self, base_url: str, token: str, session: Any) -> None:
        self.base_url = base_url
        self.token = token
        self.__class__.instances.append(self)

    async def async_fetch_summary(self) -> dict[str, Any]:
        if self.error:
            raise self.error
        return {
            "currencyCode": "EUR",
            "income_minor": 0,
            "expense_minor": 0,
            "month": "2026-10",
        }


class _SetupCoordinator:
    instances: list["_SetupCoordinator"] = []

    def __init__(self, hass: Any, logger: Any, **kwargs: Any) -> None:
        self.update_method = kwargs["update_method"]
        self.data: dict[str, Any] = {}
        self.listeners: list[Any] = []
        self.update_interval = kwargs["update_interval"]
        self.__class__.instances.append(self)

    async def async_config_entry_first_refresh(self) -> None:
        self.data = await self.update_method()

    def async_add_listener(self, listener: Any) -> Any:
        self.listeners.append(listener)
        return Mock()


class IntegrationSetupTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        _SetupApi.error = None
        _SetupApi.instances.clear()
        _SetupCoordinator.instances.clear()

    def _entry(self) -> Any:
        entry = SimpleNamespace(
            entry_id="entry-1",
            data={"base_url": "http://fin-assist/api/v1", "system_token": "system-secret"},
            options={"base_url": "http://configured/api/v1"},
            unload_callbacks=[],
        )
        entry.async_on_unload = entry.unload_callbacks.append
        entry.add_update_listener = Mock(return_value="update-listener")
        return entry

    def _hass(self) -> Any:
        return SimpleNamespace(
            data={},
            session=object(),
            config_entries=SimpleNamespace(async_forward_entry_setups=AsyncMock()),
        )

    async def test_setup_fetches_initial_data_and_registers_platforms(self) -> None:
        entry = self._entry()
        hass = self._hass()
        with (
            patch.object(integration, "FinAssistApi", _SetupApi),
            patch.object(integration, "DataUpdateCoordinator", _SetupCoordinator),
            patch.object(integration, "async_get_clientsession", return_value="session"),
            patch.object(integration, "_async_register_card", new_callable=AsyncMock),
            patch.object(integration, "_async_register_services"),
        ):
            self.assertTrue(await integration.async_setup_entry(hass, entry))

        coordinator = _SetupCoordinator.instances[0]
        self.assertEqual(_SetupApi.instances[0].base_url, "http://configured/api/v1")
        self.assertEqual(_SetupApi.instances[0].token, "system-secret")
        self.assertEqual(coordinator.update_interval, integration.UPDATE_INTERVAL)
        self.assertEqual(hass.data[integration.DOMAIN][entry.entry_id]["coordinator"], coordinator)
        hass.config_entries.async_forward_entry_setups.assert_awaited_once_with(
            entry, integration.PLATFORMS
        )
        self.assertEqual(entry.unload_callbacks, ["update-listener"])
        entry.add_update_listener.assert_called_once_with(integration._async_reload_entry)

    async def test_unauthorized_initial_refresh_requires_reauthentication(self) -> None:
        _SetupApi.error = FinAssistApiError("expired", 401)
        entry = self._entry()
        hass = self._hass()
        with (
            patch.object(integration, "FinAssistApi", _SetupApi),
            patch.object(integration, "DataUpdateCoordinator", _SetupCoordinator),
            patch.object(integration, "async_get_clientsession", return_value="session"),
        ):
            with self.assertRaises(integration.ConfigEntryAuthFailed):
                await integration.async_setup_entry(hass, entry)

        self.assertEqual(hass.data, {})

    async def test_non_auth_initial_refresh_failure_becomes_update_failed(self) -> None:
        _SetupApi.error = FinAssistApiError("service unavailable", 503)
        entry = self._entry()
        hass = self._hass()
        with (
            patch.object(integration, "FinAssistApi", _SetupApi),
            patch.object(integration, "DataUpdateCoordinator", _SetupCoordinator),
            patch.object(integration, "async_get_clientsession", return_value="session"),
        ):
            with self.assertRaises(integration.UpdateFailed):
                await integration.async_setup_entry(hass, entry)

        self.assertEqual(hass.data, {})


class SensorTests(unittest.TestCase):
    def _sensor(self, data_key: str, **data: Any) -> Any:
        coordinator = SimpleNamespace(
            data={"currencyCode": "EUR", "month": "2026-10", "income_minor": 0, "expense_minor": 0, **data}
        )
        return FinAssistMonthlyTotalSensor(
            coordinator, SimpleNamespace(entry_id="entry-1"), "income", "Income this month", data_key, "mdi:cash"
        )

    def test_sensor_converts_minor_units_and_uses_api_currency(self) -> None:
        sensor = self._sensor("income_minor", income_minor=123456)

        self.assertEqual(sensor.native_value, Decimal("1234.56"))
        self.assertEqual(sensor.native_unit_of_measurement, "EUR")
        self.assertEqual(sensor.extra_state_attributes["integration_entry_id"], "entry-1")
        self.assertEqual(sensor.extra_state_attributes["month"], "2026-10")
        self.assertEqual(sensor.extra_state_attributes["kind"], "income")


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
                "GET", "transactions"
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


class _PagedSession:
    def __init__(self, pages: list[dict[str, Any]]) -> None:
        self.pages = pages
        self.calls: list[dict[str, Any]] = []

    def request(self, method: str, url: str, **kwargs: Any) -> _RequestContext:
        self.calls.append({"method": method, "url": url, **kwargs})
        if method == "POST":
            return _RequestContext(_Response(201, {"id": "transaction-1"}))
        if method == "DELETE":
            return _RequestContext(_Response(204))
        return _RequestContext(_Response(200, self.pages[len(self.calls) - 1]))


class TransactionApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_summary_pages_current_month_and_totals_by_kind(self) -> None:
        def item(kind: str, amount: int) -> dict[str, Any]:
            return {"kind": kind, "amountMinor": amount, "currencyCode": "USD"}

        session = _PagedSession(
            [
                {"items": [item("income", 1000), item("expense", 250)], "total": 3},
                {"items": [item("expense", 50)], "total": 3},
            ]
        )
        with patch.object(importlib.import_module("custom_components.ha_finassists.api"), "date") as fake_date:
            fake_date.today.return_value = date(2026, 2, 10)
            summary = await FinAssistApi("http://fin-assist/api/v1", "token", session).async_fetch_summary()

        self.assertEqual(
            summary,
            {"currencyCode": "USD", "income_minor": 1000, "expense_minor": 300, "month": "2026-02"},
        )
        first, second = session.calls
        self.assertEqual(first["params"]["fromDate"], "2026-02-01")
        self.assertEqual(first["params"]["toDate"], "2026-02-28")
        self.assertEqual(first["params"]["offset"], 0)
        self.assertEqual(second["params"]["offset"], 2)

    async def test_summary_falls_back_to_default_currency_without_transactions(self) -> None:
        session = _PagedSession([{"items": [], "total": 0}])
        summary = await FinAssistApi("http://fin-assist/api/v1", "token", session).async_fetch_summary()

        self.assertEqual(summary["currencyCode"], "EUR")
        self.assertEqual((summary["income_minor"], summary["expense_minor"]), (0, 0))

    async def test_create_transaction_posts_contract_body(self) -> None:
        session = _PagedSession([])
        api = FinAssistApi("http://fin-assist/api/v1", "token", session)
        await api.async_create_transaction("expense", 1250, date(2026, 10, 24), "Lunch")
        await api.async_create_transaction("income", 500, date(2026, 10, 24), None)

        self.assertEqual(session.calls[0]["method"], "POST")
        self.assertTrue(session.calls[0]["url"].endswith("/transactions"))
        self.assertEqual(
            session.calls[0]["json"],
            {"kind": "expense", "amountMinor": 1250, "transactionDate": "2026-10-24", "description": "Lunch"},
        )
        self.assertNotIn("description", session.calls[1]["json"])

    async def test_delete_transaction_uses_contract_path(self) -> None:
        session = _PagedSession([])
        api = FinAssistApi("http://fin-assist/api/v1", "token", session)
        await api.async_delete_transaction("transaction-1")

        self.assertEqual(session.calls[0]["method"], "DELETE")
        self.assertTrue(session.calls[0]["url"].endswith("/transactions/transaction-1"))


class TransactionServiceTests(unittest.IsolatedAsyncioTestCase):
    def _register(self) -> tuple[dict[str, Any], Any, Any]:
        handlers: dict[str, Any] = {}
        hass = SimpleNamespace(
            data={},
            services=SimpleNamespace(
                has_service=lambda domain, service: False,
                async_register=lambda domain, service, handler, schema: handlers.__setitem__(service, handler),
            ),
        )
        api = SimpleNamespace(async_create_transaction=AsyncMock(), async_delete_transaction=AsyncMock())
        coordinator = SimpleNamespace(
            data={"currencyCode": "EUR"}, async_request_refresh=AsyncMock()
        )
        hass.data["ha_finassists"] = {"entry-1": {"api": api, "coordinator": coordinator}}
        integration._async_register_services(hass)
        return handlers, api, coordinator

    async def test_add_expense_converts_amount_and_refreshes(self) -> None:
        handlers, api, coordinator = self._register()
        call = SimpleNamespace(
            data={"entry_id": "entry-1", "amount": "12.5", "date": date(2026, 10, 1), "description": "Lunch"}
        )
        await handlers["add_expense"](call)

        api.async_create_transaction.assert_awaited_once_with(
            "expense", 1250, date(2026, 10, 1), "Lunch"
        )
        coordinator.async_request_refresh.assert_awaited_once()

    async def test_add_income_defaults_to_today(self) -> None:
        handlers, api, _ = self._register()
        await handlers["add_income"](SimpleNamespace(data={"entry_id": "entry-1", "amount": "100"}))

        api.async_create_transaction.assert_awaited_once_with("income", 10000, date.today(), None)

    async def test_excess_precision_and_unknown_entry_are_rejected(self) -> None:
        handlers, api, _ = self._register()
        with self.assertRaises(ValueError):
            await handlers["add_expense"](SimpleNamespace(data={"entry_id": "entry-1", "amount": "1.005"}))
        with self.assertRaises(ValueError):
            await handlers["add_expense"](SimpleNamespace(data={"entry_id": "missing", "amount": "1"}))
        api.async_create_transaction.assert_not_awaited()

    async def test_delete_transaction_removes_and_refreshes(self) -> None:
        handlers, api, coordinator = self._register()
        await handlers["delete_transaction"](
            SimpleNamespace(data={"entry_id": "entry-1", "transaction_id": "transaction-1"})
        )

        api.async_delete_transaction.assert_awaited_once_with("transaction-1")
        coordinator.async_request_refresh.assert_awaited_once()

    async def test_delete_transaction_rejects_unknown_entry(self) -> None:
        handlers, api, _ = self._register()
        with self.assertRaises(ValueError):
            await handlers["delete_transaction"](
                SimpleNamespace(data={"entry_id": "missing", "transaction_id": "transaction-1"})
            )
        api.async_delete_transaction.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
