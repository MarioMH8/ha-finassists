# Fin Assist

A self-hosted financial app for Home Assistant, distributed as a Home Assistant app and HACS integration from one repository. The product and domain are documented in the [project brief](docs/PROJECT-BRIEF.md), [glossary](CONTEXT.md), and [ADRs](docs/adr/).

## Current scope

Fin Assist is intentionally minimal: it records **expenses and incomes** and nothing else. There are no accounts, categories, budgets, schedules, imports, or shared expenses; the product will grow from this base iteratively.

- **Ingress UI:** a form to add an expense or income, a monthly summary, a recent-transactions list, and personal API-token management.
- **REST API:** `GET`/`POST /api/v1/transactions` (see [the OpenAPI contract](docs/api-v1.openapi.yaml)).
- **MCP:** `create_transaction` and `list_transactions` tools at `/mcp` (Streamable HTTP, bearer token).
- **Home Assistant integration:** monthly income/expense sensors and `add_expense`, `add_income`, and `refresh` services; see [its README](custom_components/ha_finassists/README.md).
- **Currency:** one currency for the whole installation, set with the app's `currency` option (ISO 4217, default `EUR`).

Upgrading from a build with the full financial model drops the old financial tables (books, accounts, transactions, ...) on first start; API tokens and the Home Assistant system credential are preserved.

## Development

Requires Bun 1.4 or later. React 19 and React DOM provide server rendering and client hydration; the remaining application runtime uses Bun APIs. TypeScript, React types, and Bun types are development-only.

```sh
bun install --frozen-lockfile
cp .env.example .env
bun run dev       # Watch server files; use a local mock Ingress identity
bun run build     # Build production server and browser assets into dist/
bun run start     # Start the production build on port 8099
```

Development reads `DEV_INGRESS_USER_ID`, `DEV_INGRESS_USERNAME`, and `DEV_INGRESS_DISPLAY_NAME` from `.env`, bypasses the Ingress peer check, and reloads open pages when Bun restarts the server. Production rejects these mock identity settings and enforces the configured Supervisor peer address. `/health` returns a JSON health status, `/api/v1/session` reports the current actor, and `/api/v1/tokens` lets that actor issue, list, and revoke only their own tokens. Newly issued secrets are returned once. `/mcp` exposes the transaction tools to bearer-token clients, and `/api/v1/transactions` lists and records transactions.

The browser UI is implemented with React 19 and CSS under `src/app`. During development, Bun compiles the client bundle in memory; production builds the browser bundle and server into `dist/`. The page language is selected from `Accept-Language`, and the CSS follows the system light/dark preference; Home Assistant theme synchronization remains future work. The service listens on `PORT` (default `8099`) and stores API tokens and transactions in `/data/fin-assist.sqlite`; set `DATABASE_PATH` to override that location for local development.

The add-on's `supervisor_ip` option defaults to Home Assistant's standard Supervisor address. Override it for non-standard network setups. `SUPERVISOR_IP` can override the option when running the container directly; invalid addresses fail startup.

## Home Assistant packaging

The repository root contains the app `config.yaml` and `Dockerfile`; it targets `amd64` and `aarch64`, enables Ingress, does not publish a host port, and reserves `/data` for persistent app data. The custom integration lives under `custom_components/ha_finassists`.

## Direction

The product starts from this minimal base and adds capabilities one at a time (for example categories, accounts, or scheduled payments). Earlier designs for those features were removed from the code; see [the project brief](docs/PROJECT-BRIEF.md). The final product targets both `amd64` and `aarch64`. API/MCP authentication and the Supervisor trust boundary are described in the [identity and token ADR](docs/adr/0004-home-assistant-identity-and-tokens.md) and [MCP transport ADR](docs/adr/0005-mcp-streamable-http.md).
