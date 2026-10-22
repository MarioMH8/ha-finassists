# Fin Assist

A self-hosted financial app for Home Assistant, distributed as a Home Assistant app and HACS integration from one repository. The product and domain are documented in the [project brief](docs/PROJECT-BRIEF.md), [glossary](CONTEXT.md), and [ADRs](docs/adr/).

## Scaffold status

The Bun app includes a Home Assistant Ingress shell, bilingual Spanish/English copy, health and session endpoints, a personal API-token management UI, issue/list/revoke routes, and SQLite persistence for those tokens. Users can create and revoke their own tokens, copy a newly issued secret once, and review token names and creation dates. Ingress identity is used for token ownership and is trusted only from the configured Supervisor peer. Financial records, the financial REST/MCP APIs, and the native integration are not implemented yet.

## Development

Requires Bun 1.4 or later. React 19 and React DOM provide server rendering and client hydration; the remaining application runtime uses Bun APIs. TypeScript, React types, and Bun types are development-only.

```sh
bun install --frozen-lockfile
SUPERVISOR_IP=::1 bun run dev  # Run locally with file watching
bun run start                 # Start the app on port 8099
```

Run focused checks independently with `bun run lint:ci`, `bun run typecheck`, and `bun run test`. The service listens on `PORT` (default `8099`) and stores API tokens in `/data/fin-assist.sqlite`; set `DATABASE_PATH` to override that location for local development. `/health` returns a JSON health status, `/api/v1/session` reports the trusted Ingress actor, and `/api/v1/tokens` lets that actor issue, list, and revoke only their own tokens. Newly issued secrets are returned once. The MCP (`/mcp`) and financial REST endpoints are not implemented yet. The browser UI is implemented with React 19 and CSS under `src/app/web`. The server renders the page and serves a client bundle Bun compiles once in memory at startup; there is no separate frontend build command or generated build directory. The page language is selected from the request's `Accept-Language` header, and the CSS follows the system light/dark preference; Home Assistant theme synchronization remains future work.

The add-on's `supervisor_ip` option defaults to Home Assistant's standard Supervisor address. Override it for non-standard network setups. `SUPERVISOR_IP` can override the option when running the container directly; invalid addresses fail startup. Direct local development should set `SUPERVISOR_IP` to the local peer address.

## Home Assistant packaging

The repository root contains the app `config.yaml` and `Dockerfile`; it targets `amd64` and `aarch64`, enables Ingress, does not publish a host port, and reserves `/data` for persistent app data. The custom integration will live under `custom_components/ha_finassists`.

## Product scope and delivery order

1. Books, accounts, transactions, transfers, QIF/CSV imports, Ingress UI, REST, MCP, and backed-up SQLite persistence.
2. Budgets, scheduled payments, and shared expenses.
3. Native Home Assistant integration and Lovelace card.

The final product targets both `amd64` and `aarch64`. API/MCP authentication and the Supervisor trust boundary must be in place before those interfaces are exposed; see the [identity and token ADR](docs/adr/0004-home-assistant-identity-and-tokens.md) and [MCP transport ADR](docs/adr/0005-mcp-streamable-http.md).
