# Fin Assist

A self-hosted financial app for Home Assistant, distributed as a Home Assistant app and HACS integration from one repository. The product and domain are documented in the [project brief](docs/PROJECT-BRIEF.md), [glossary](CONTEXT.md), and [ADRs](docs/adr/).

## Scaffold status

The Bun scaffold includes a Home Assistant Ingress app shell, bilingual Spanish/English copy, a health endpoint, a session endpoint that trusts Supervisor identity headers only from the configured Supervisor peer, an add-on container definition, and CI checks. This identity is for attribution, not authorization. Financial records, SQLite persistence, REST, MCP, and the native integration are not implemented yet.

## Development

Requires Bun 1.4 or later. The app has no runtime dependencies; TypeScript and Bun types are development-only.

```sh
bun install --frozen-lockfile
SUPERVISOR_IP=::1 bun run dev  # Run locally with file watching
bun run start                 # Start the app on port 8099
```

Run focused checks independently with `bun run lint:ci`, `bun run typecheck`, and `bun run test`. The service listens on `PORT` (default `8099`). `/health` returns a JSON health status, and `/api/v1/session` reports the Ingress actor only for requests from the configured Supervisor IP. The UI rejects other peers, while the session route treats identity headers from other peers as unknown. The REST (`/api/v1/`) and MCP (`/mcp`) namespaces remain available to network clients and must enforce token authentication when implemented. The browser UI is plain JavaScript, HTML, and CSS without a frontend framework or build step; it is served directly from `src/app/web` beside the server code in `src/app`. The scaffold follows the system light/dark preference; Home Assistant theme synchronization remains future work.

The add-on's `supervisor_ip` option defaults to Home Assistant's standard Supervisor address. Override it for non-standard network setups. `SUPERVISOR_IP` can override the option when running the container directly; invalid addresses fail startup. Direct local development should set `SUPERVISOR_IP` to the local peer address.

## Home Assistant packaging

The repository root contains the app `config.yaml` and `Dockerfile`; it targets `amd64` and `aarch64`, enables Ingress, does not publish a host port, and reserves `/data` for persistent app data. The custom integration will live under `custom_components/ha_finassists`.

## Product scope and delivery order

1. Books, accounts, transactions, transfers, QIF/CSV imports, Ingress UI, REST, MCP, and backed-up SQLite persistence.
2. Budgets, scheduled payments, and shared expenses.
3. Native Home Assistant integration and Lovelace card.

The final product targets both `amd64` and `aarch64`. API/MCP authentication and the Supervisor trust boundary must be in place before those interfaces are exposed; see the [identity and token ADR](docs/adr/0004-home-assistant-identity-and-tokens.md) and [MCP transport ADR](docs/adr/0005-mcp-streamable-http.md).
