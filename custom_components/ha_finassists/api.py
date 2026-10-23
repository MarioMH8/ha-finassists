"""Async REST client and system-identity lifecycle adapter."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any
from urllib.parse import urljoin

from aiohttp import ClientError, ClientSession, ClientTimeout

from .dates import last_occurrence_date


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
                return await response.json()
        except (ClientError, TimeoutError) as err:
            raise FinAssistApiError(f"Could not connect to Fin Assist: {err}") from err

    async def async_page(self, path: str) -> list[dict[str, Any]]:
        """Read all items from the contract's limit/offset pagination."""
        items: list[dict[str, Any]] = []
        offset = 0
        while True:
            page = await self.async_request("GET", path, params={"limit": 100, "offset": offset})
            if not isinstance(page, dict) or not isinstance(page.get("items"), list):
                raise FinAssistApiError("Fin Assist returned an invalid page")
            items.extend(item for item in page["items"] if isinstance(item, dict))
            total = page.get("total", len(items))
            offset += len(page["items"])
            if offset >= total or not page["items"]:
                return items

    async def async_fetch_dashboard(
        self, previous_schedules: list[dict[str, Any]] | None = None
    ) -> dict[str, Any]:
        """Fetch books, accounts, balances, and finite upcoming schedules."""
        books = await self.async_page("books")
        book_data: list[dict[str, Any]] = []
        schedule_data: list[dict[str, Any]] = []
        today = date.today()
        schedule_refresh_failed = False
        for book in books:
            book_id = str(book["id"])
            accounts = await self.async_page(f"books/{book_id}/accounts")
            live_accounts: list[dict[str, Any]] = []
            for account in accounts:
                if account.get("closedAt"):
                    continue
                balance = await self.async_request(
                    "GET", f"books/{book_id}/accounts/{account['id']}/balances"
                )
                live_accounts.append({**account, "balance": balance})
            book_data.append({**book, "accounts": live_accounts})
            try:
                schedules = await self.async_page(f"books/{book_id}/schedules")
            except FinAssistApiError as err:
                if err.status == 401:
                    raise
                schedule_refresh_failed = True
                schedule_data.extend(
                    schedule
                    for schedule in previous_schedules or []
                    if str(schedule.get("bookId")) == book_id
                )
                continue
            for schedule in schedules:
                if schedule.get("status") not in ("active", "paused"):
                    continue
                end_date = schedule.get("endDate")
                if end_date:
                    try:
                        end_date = date.fromisoformat(end_date)
                    except (TypeError, ValueError):
                        continue
                else:
                    end_date = last_occurrence_date(schedule)
                if end_date and today <= end_date <= today + timedelta(days=30):
                    schedule_data.append({**schedule, "bookName": book.get("name")})
        return {
            "books": book_data,
            "upcoming_schedules": schedule_data,
            "schedule_refresh_failed": schedule_refresh_failed,
        }

    async def async_set_schedule_status(self, book_id: str, schedule_id: str, status: str) -> None:
        """Pause, resume, or cancel a scheduled payment."""
        await self.async_request(
            "PUT",
            f"books/{book_id}/schedules/{schedule_id}/status",
            json={"status": status},
        )

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
