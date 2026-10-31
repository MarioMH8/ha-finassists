"""Async REST client and system-identity lifecycle adapter."""

from __future__ import annotations

import calendar
from datetime import date, timedelta
from typing import Any
from urllib.parse import urljoin

from aiohttp import ClientError, ClientSession, ClientTimeout
from babel.numbers import get_currency_precision

from .const import DEFAULT_CAPABILITIES

DEFAULT_CURRENCY_CODE = "EUR"


def _currency_precision(currency_code: str) -> int:
    """Return a safe currency precision for API payloads."""
    try:
        return int(get_currency_precision(currency_code))
    except Exception:
        return 2


def _major_units(value: Any, scale: int) -> float:
    """Convert an exact minor-unit amount into a display amount."""
    try:
        return int(value) / scale
    except (TypeError, ValueError):
        return 0.0


def _scheduled_item(
    item: dict[str, Any], names: dict[str, str], scale: int
) -> dict[str, Any]:
    """Shape one projected occurrence for sensor attributes."""
    return {
        "schedule_id": str(item.get("scheduleId") or ""),
        "due_date": str(item.get("dueDate") or ""),
        "kind": str(item.get("kind") or "expense"),
        "description": str(item.get("description") or ""),
        "amount": _major_units(item.get("amountMinor"), scale),
        "category": names.get(str(item.get("categoryId") or ""), ""),
    }


class FinAssistApiError(Exception):
    """An API request failed or returned an invalid response."""

    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


class FinAssistApi:
    """Client for the Fin Assist v1 API and system-credential lifecycle."""

    def __init__(self, base_url: str, token: str, session: ClientSession) -> None:
        self.base_url = base_url.rstrip("/") + "/"
        self.token = token
        self.session = session

    async def async_request(
        self, method: str, path: str, *, params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> Any:
        """Make an authenticated API request and decode JSON responses."""
        timeout = ClientTimeout(total=15)
        headers = {"Authorization": "Bearer " + self.token} if self.token else {}
        try:
            async with self.session.request(
                method,
                urljoin(self.base_url, path.lstrip("/")),
                headers=headers,
                params=params,
                json=json,
                timeout=timeout,
            ) as response:
                if response.status == 204:
                    return None
                if response.status >= 400:
                    raise FinAssistApiError(
                        f"Fin Assist returned HTTP {response.status}", response.status
                    )
                if response.content_type != "application/json":
                    raise FinAssistApiError("Fin Assist returned a non-JSON response")
                try:
                    return await response.json()
                except ValueError as err:
                    raise FinAssistApiError("Fin Assist returned malformed JSON") from err
        except (ClientError, TimeoutError) as err:
            raise FinAssistApiError(f"Could not connect to Fin Assist: {err}") from err

    async def async_page(
        self, path: str, params: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """Read all items from the contract's limit/offset pagination."""
        items: list[dict[str, Any]] = []
        offset = 0
        while True:
            page = await self.async_request("GET", path, params={**(params or {}), "limit": 100, "offset": offset}
            )
            if not isinstance(page, dict) or not isinstance(page.get("items"), list):
                raise FinAssistApiError("Fin Assist returned an invalid page")
            items.extend(item for item in page["items"] if isinstance(item, dict))
            total = page.get("total", len(items))
            offset += len(page["items"])
            if offset >= total or not page["items"]:
                return items

    async def async_fetch_capabilities(self) -> dict[str, bool]:
        """Read the capabilities enabled by the app."""
        try:
            result = await self.async_request("GET", "capabilities")
        except FinAssistApiError as err:
            if err.status == 404:
                return dict(DEFAULT_CAPABILITIES)
            raise
        if not isinstance(result, dict) or not isinstance(result.get("features"), dict):
            raise FinAssistApiError("Fin Assist returned invalid capabilities")
        features = result["features"]

        return {
            "categories": bool(features.get("categories", True)),
            "scheduledTransactions": bool(features.get("scheduledTransactions", True)),
        }

    async def async_fetch_summary(
        self, currency_code: str = DEFAULT_CURRENCY_CODE
    ) -> dict[str, Any]:
        """Total income and expenses, and their breakdown by category."""
        today = date.today()
        last_day = calendar.monthrange(today.year, today.month)[1]
        transactions = await self.async_page(
            "transactions",
            {
                "fromDate": today.replace(day=1).isoformat(),
                "toDate": today.replace(day=last_day).isoformat(),
            },
        )
        totals = {"income": 0, "expense": 0}
        per_category: dict[str, dict[str, int]] = {"income": {}, "expense": {}}
        uncategorized = {"income": 0, "expense": 0}
        currency: str | None = None
        for transaction in transactions:
            amount = transaction.get("amountMinor")
            kind = transaction.get("kind")
            if kind not in totals or not isinstance(amount, int) or isinstance(amount, bool):
                raise FinAssistApiError("Fin Assist returned an invalid transaction")
            totals[kind] += amount
            currency = currency or transaction.get("currencyCode")
            category_id = transaction.get("categoryId")
            if isinstance(category_id, str) and category_id:
                categories_for_kind = per_category[kind]
                categories_for_kind[category_id] = categories_for_kind.get(category_id, 0) + amount
            else:
                uncategorized[kind] += amount
        summary: dict[str, Any] = {
            "currencyCode": str(currency or currency_code),
            "income_minor": totals["income"],
            "expense_minor": totals["expense"],
            "month": today.strftime("%Y-%m"),
        }
        try:
            categories = await self.async_list_categories()
        except FinAssistApiError:
            # The monthly totals stay usable even when the breakdown is unavailable.
            return summary
        names = {
            str(category["id"]): str(category["name"])
            for category in categories
            if isinstance(category.get("id"), str) and isinstance(category.get("name"), str)
        }
        for kind in ("income", "expense"):
            summary[f"{kind}_by_category"] = {
                names.get(category_id, "Unknown"): amount
                for category_id, amount in per_category[kind].items()
            }
            summary[f"uncategorized_{kind}_minor"] = uncategorized[kind]
        return summary

    async def async_fetch_scheduled_summary(
        self, currency_code: str = DEFAULT_CURRENCY_CODE
    ) -> dict[str, Any]:
        """Forecast the next 30 days and list manual occurrences waiting for confirmation."""
        today = date.today()
        from_date = today
        to_date = today + timedelta(days=29)
        forecast = await self.async_request(
            "GET",
            "scheduled-transactions/upcoming",
            params={
                "fromDate": from_date.isoformat(),
                "toDate": to_date.isoformat(),
                "limit": 200,
            },
        )
        if not isinstance(forecast, dict):
            raise FinAssistApiError("Fin Assist returned an invalid forecast")
        totals = forecast.get("totals")
        by_category = forecast.get("byCategory")
        uncategorized = forecast.get("uncategorized")
        items = forecast.get("items")
        if (
            not isinstance(totals, dict)
            or not isinstance(by_category, dict)
            or not isinstance(uncategorized, dict)
            or not isinstance(items, list)
        ):
            raise FinAssistApiError("Fin Assist returned an invalid forecast")
        forecast_currency = str(forecast.get("currencyCode") or currency_code)
        try:
            categories = await self.async_list_categories()
        except FinAssistApiError:
            names: dict[str, str] = {}
        else:
            names = {
                str(category["id"]): str(category["name"])
                for category in categories
                if isinstance(category.get("id"), str) and isinstance(category.get("name"), str)
            }
        scale = 10 ** _currency_precision(forecast_currency)
        projected = [
            _scheduled_item(item, names, scale)
            for item in items
            if isinstance(item, dict)
        ][:10]
        due = await self.async_page(
            "scheduled-transactions",
            {
                "dueThrough": today.isoformat(),
                "postingMode": "manual",
                "status": "active",
            },
        )
        due_items = [
            {
                "id": str(schedule.get("id") or ""),
                "description": str(schedule.get("description") or ""),
                "due_date": str(schedule.get("nextDueDate") or ""),
                "amount": _major_units(schedule.get("amountMinor"), scale),
                "kind": str(schedule.get("kind") or "expense"),
                "category": names.get(str(schedule.get("categoryId") or ""), ""),
            }
            for schedule in due
        ]
        scheduled: dict[str, Any] = {
            "scheduled_currency_code": forecast_currency,
            "scheduled_from_date": str(forecast.get("fromDate") or from_date.isoformat()),
            "scheduled_to_date": str(forecast.get("toDate") or to_date.isoformat()),
            "scheduled_income_minor": int(totals.get("incomeMinor", 0)),
            "scheduled_expense_minor": int(totals.get("expenseMinor", 0)),
            "scheduled_net_minor": int(totals.get("netMinor", 0)),
            "scheduled_items": projected,
            "scheduled_due_count": len(due_items),
            "scheduled_due_items": due_items,
        }
        for kind in ("income", "expense"):
            current = by_category.get(kind)
            if not isinstance(current, dict):
                raise FinAssistApiError("Fin Assist returned an invalid category forecast")
            scheduled[f"scheduled_{kind}_by_category"] = {
                names.get(str(category_id), "Unknown"): _major_units(amount, scale)
                for category_id, amount in current.items()
            }
            scheduled[f"scheduled_uncategorized_{kind}_minor"] = int(
                uncategorized.get(f"{kind}Minor", 0)
            )
        return scheduled

    async def async_list_categories(self, kind: str | None = None) -> list[dict[str, Any]]:
        """Read every category, optionally filtered by kind."""
        result = await self.async_request(
            "GET", "categories", params={"kind": kind} if kind else None
        )
        if not isinstance(result, dict) or not isinstance(result.get("items"), list):
            raise FinAssistApiError("Fin Assist returned an invalid category list")
        return [item for item in result["items"] if isinstance(item, dict)]

    async def async_create_transaction(
        self,
        kind: str,
        amount_minor: int,
        transaction_date: date,
        description: str | None = None,
        category_id: str | None = None,
    ) -> dict[str, Any]:
        """Record an expense or income, optionally grouped by category."""
        body: dict[str, Any] = {
            "kind": kind,
            "amountMinor": amount_minor,
            "transactionDate": transaction_date.isoformat(),
        }
        if description:
            body["description"] = description
        if category_id:
            body["categoryId"] = category_id
        result = await self.async_request("POST", "transactions", json=body)
        if not isinstance(result, dict):
            raise FinAssistApiError("Fin Assist returned an invalid transaction")
        return result

    async def async_delete_transaction(self, transaction_id: str) -> None:
        """Delete a recorded transaction."""
        await self.async_request("DELETE", f"transactions/{transaction_id}")

    async def async_create_scheduled_transaction(
        self,
        kind: str,
        amount_minor: int,
        start_date: date,
        frequency: str,
        interval: int = 1,
        end_date: date | None = None,
        description: str | None = None,
        category_id: str | None = None,
        automatic: bool = True,
    ) -> dict[str, Any]:
        """Create a one-time or recurring scheduled expense or income."""
        body: dict[str, Any] = {
            "amountMinor": amount_minor,
            "frequency": frequency,
            "interval": interval,
            "kind": kind,
            "postingMode": "automatic" if automatic else "manual",
            "startDate": start_date.isoformat(),
        }
        if end_date is not None:
            body["endDate"] = end_date.isoformat()
        if description:
            body["description"] = description
        if category_id:
            body["categoryId"] = category_id
        result = await self.async_request("POST", "scheduled-transactions", json=body)
        if not isinstance(result, dict):
            raise FinAssistApiError("Fin Assist returned an invalid scheduled transaction")
        return result

    async def async_delete_scheduled_transaction(self, scheduled_transaction_id: str) -> None:
        """Delete a scheduled transaction without touching posted transactions."""
        await self.async_request(
            "DELETE", f"scheduled-transactions/{scheduled_transaction_id}"
        )

    async def async_post_scheduled_transaction(
        self, scheduled_transaction_id: str
    ) -> dict[str, Any]:
        """Post the next due occurrence of a scheduled transaction."""
        result = await self.async_request(
            "POST", f"scheduled-transactions/{scheduled_transaction_id}/post"
        )
        if not isinstance(result, dict):
            raise FinAssistApiError("Fin Assist returned an invalid scheduled posting")
        return result

    async def async_skip_scheduled_transaction(
        self, scheduled_transaction_id: str
    ) -> dict[str, Any]:
        """Skip the next due occurrence without recording a transaction."""
        result = await self.async_request(
            "POST", f"scheduled-transactions/{scheduled_transaction_id}/skip"
        )
        if not isinstance(result, dict):
            raise FinAssistApiError("Fin Assist returned an invalid scheduled skip")
        return result

    async def async_exchange_bootstrap_capability(
        self, bootstrap_capability: str
    ) -> dict[str, str]:
        """Exchange a single-use Supervisor capability for a system credential."""
        result = await self.async_request(
            "POST",
            "system-credentials/exchange",
            json={"bootstrapCapability": bootstrap_capability},
        )
        return self._parse_system_credential(result)

    async def async_rotate_system_credential(self) -> dict[str, str]:
        """Rotate the current credential using its authenticated identity."""
        result = await self.async_request("PUT", "system-credentials/current")
        return self._parse_system_credential(result)

    async def async_revoke_system_credential(self) -> None:
        """Revoke the current system credential."""
        if self.token:
            await self.async_request("DELETE", "system-credentials/current")

    @staticmethod
    def _parse_system_credential(result: Any) -> dict[str, str]:
        if not isinstance(result, dict) or not result.get("id") or not result.get("credential"):
            raise FinAssistApiError("Fin Assist returned an invalid system credential")
        return {
            "system_token": str(result["credential"]),
            "credential_id": str(result["id"]),
        }
