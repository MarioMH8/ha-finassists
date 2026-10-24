"""Async REST client and system-identity lifecycle adapter."""

from __future__ import annotations

import calendar
from datetime import date
from typing import Any
from urllib.parse import urljoin

from aiohttp import ClientError, ClientSession, ClientTimeout

DEFAULT_CURRENCY_CODE = "EUR"


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

    async def async_fetch_summary(
        self, currency_code: str = DEFAULT_CURRENCY_CODE
    ) -> dict[str, Any]:
        """Total income and expenses for the current calendar month."""
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
        currency: str | None = None
        for transaction in transactions:
            amount = transaction.get("amountMinor")
            kind = transaction.get("kind")
            if kind not in totals or not isinstance(amount, int) or isinstance(amount, bool):
                raise FinAssistApiError("Fin Assist returned an invalid transaction")
            totals[kind] += amount
            currency = currency or transaction.get("currencyCode")
        return {
            "currencyCode": str(currency or currency_code),
            "income_minor": totals["income"],
            "expense_minor": totals["expense"],
            "month": today.strftime("%Y-%m"),
        }

    async def async_create_transaction(
        self,
        kind: str,
        amount_minor: int,
        transaction_date: date,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Record an expense or income."""
        body: dict[str, Any] = {
            "kind": kind,
            "amountMinor": amount_minor,
            "transactionDate": transaction_date.isoformat(),
        }
        if description:
            body["description"] = description
        result = await self.async_request("POST", "transactions", json=body)
        if not isinstance(result, dict):
            raise FinAssistApiError("Fin Assist returned an invalid transaction")
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
