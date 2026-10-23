# Fin Assist

A self-hosted financial app for Home Assistant, distributed as a Home Assistant app and HACS integration from one repository. The product and domain are documented in the [project brief](docs/PROJECT-BRIEF.md), [glossary](CONTEXT.md), and [ADRs](docs/adr/).

## Scaffold status

The Bun app includes a Home Assistant Ingress shell, bilingual Spanish/English copy, health and session endpoints, a personal API-token management UI, issue/list/revoke routes, and SQLite persistence for those tokens. Users can create and revoke their own tokens, copy a newly issued secret once, and review token names and creation dates. Ingress identity is used for token ownership and is trusted only from the configured Supervisor peer. Financial records, the financial REST/MCP APIs, and the native integration are not implemented yet.

## Development

Requires Bun 1.4 or later. React 19 and React DOM provide server rendering and client hydration; the remaining application runtime uses Bun APIs. TypeScript, React types, and Bun types are development-only.

```sh
bun install --frozen-lockfile
cp .env.example .env
bun run dev       # Watch server files; use a local mock Ingress identity
bun run build     # Build production server and browser assets into dist/
bun run start     # Start the production build on port 8099
```

Development reads `DEV_INGRESS_USER_ID`, `DEV_INGRESS_USERNAME`, and `DEV_INGRESS_DISPLAY_NAME` from `.env`, bypasses the Ingress peer check, and reloads open pages when Bun restarts the server. Production rejects these mock identity settings and enforces the configured Supervisor peer address. `/health` returns a JSON health status, `/api/v1/session` reports the current actor, and `/api/v1/tokens` lets that actor issue, list, and revoke only their own tokens. Newly issued secrets are returned once. The MCP (`/mcp`) and financial REST endpoints are not implemented yet.

The browser UI is implemented with React 19 and CSS under `src/app`. During development, Bun compiles the client bundle in memory; production builds the browser bundle and server into `dist/`. The page language is selected from `Accept-Language`, and the CSS follows the system light/dark preference; Home Assistant theme synchronization remains future work. The service listens on `PORT` (default `8099`) and stores API tokens in `/data/fin-assist.sqlite`; set `DATABASE_PATH` to override that location for local development.

The add-on's `supervisor_ip` option defaults to Home Assistant's standard Supervisor address. Override it for non-standard network setups. `SUPERVISOR_IP` can override the option when running the container directly; invalid addresses fail startup.

## Home Assistant packaging

The repository root contains the app `config.yaml` and `Dockerfile`; it targets `amd64` and `aarch64`, enables Ingress, does not publish a host port, and reserves `/data` for persistent app data. The custom integration will live under `custom_components/ha_finassists`.

## Product scope and delivery order

1. Books, accounts, transactions, transfers, QIF/CSV imports, Ingress UI, REST, MCP, and backed-up SQLite persistence.
2. Budgets, scheduled payments, and shared expenses.
3. Native Home Assistant integration and Lovelace card.

The final product targets both `amd64` and `aarch64`. API/MCP authentication and the Supervisor trust boundary must be in place before those interfaces are exposed; see the [identity and token ADR](docs/adr/0004-home-assistant-identity-and-tokens.md) and [MCP transport ADR](docs/adr/0005-mcp-streamable-http.md).
