# Contributing to Fin Assist

Thanks for taking a look. Fin Assist is a self-hosted financial app for Home Assistant, distributed as one repository: a Home Assistant app (add-on), a HACS integration and a Lovelace card. This guide covers running it locally and the rules the code follows. For what the product is and why it is small, read the [project brief](docs/PROJECT-BRIEF.md).

## Ways to help

- **Report a bug** with the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml).
- **Suggest a feature** with the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml).
- **Send a pull request** for a fix, a test or a documentation improvement.

New capabilities are added one at a time, each with its own decision record, so please open an issue before building a large feature.

## Local development

Requirements: Bun 1.4 or later. React 19 and React DOM provide server rendering and client hydration; the rest of the runtime uses Bun APIs. TypeScript, React types and Bun types are development-only.

```sh
bun install --frozen-lockfile
cp .env.example .env
bun run dev       # Watch server files; use a local mock Ingress identity
bun run build     # Build the production server and browser assets into dist/
bun run start     # Start the production build on port 8099
```

| Task | Command |
| --- | --- |
| Install locked dependencies | `bun install --frozen-lockfile` |
| Start with file watching and a mock Ingress identity | `bun run dev` |
| Build server and browser assets | `bun run build` |
| Start the production build | `bun run start` |
| Lint without modifying files | `bun run lint:ci` |
| Fix lint findings | `bun run lint:fix` |
| Type-check | `bun run typecheck` |
| Run tests | `bun run test` |

Development reads `DEV_INGRESS_USER_ID`, `DEV_INGRESS_USERNAME` and `DEV_INGRESS_DISPLAY_NAME` from `.env`, bypasses the Ingress peer check and reloads open pages when Bun restarts the server. Production rejects those mock identity settings and enforces the configured Supervisor peer address.

## How the app is put together

| Surface | Location | Responsibility |
| --- | --- | --- |
| Home Assistant app | `config.yaml`, `Dockerfile` | Add-on metadata, runtime image, Ingress entry point and persistent data mapping. |
| Bun service | `src/server.ts`, `src/app-bootstrap.ts`, `src/app-container.ts` | Startup, configuration and the InferDI container that composes repositories and use cases. |
| HTTP API | `src/modules/api/infrastructure/http/` | Hono routes with Zod validation, security headers and web asset delivery. |
| Web interface | `src/app/` | React 19 UI with JSON translations and CSS Modules, rendered with Bun SSR and hydrated from a client bundle. |
| Native integration | `custom_components/ha_finassists/` | Config flow, REST client, sensors, services and the bundled Lovelace card. |

Runtime surfaces:

- `/health` returns a JSON health status.
- `/api/v1/session` reports the current actor; `/api/v1/tokens` lets that actor issue, list and revoke only their own
  tokens. Newly issued secrets are returned once.
- `/api/v1/transactions` lists, records, updates and deletes transactions. The contract is in
  [docs/api-v1.openapi.yaml](docs/api-v1.openapi.yaml).
- `/mcp` exposes `create_transaction`, `list_transactions` and `delete_transaction` over Streamable HTTP with a bearer
  token.
- `/api/v1/system-credentials/*` carries the integration's system identity, separate from personal tokens.

The browser UI is implemented with React 19 and CSS under `src/app`. Development compiles the client bundle in memory; production builds the browser bundle and server into `dist/`. The page language follows `Accept-Language` and the CSS follows the system light/dark preference; Home Assistant theme synchronization is future work. The service listens on `PORT` (default `8099`) and stores API tokens and transactions in `/data/fin-assist.sqlite`; set `DATABASE_PATH` to override that location locally.

## Home Assistant packaging

The repository root contains the app `config.yaml` and `Dockerfile`. The app targets `amd64` and `aarch64`, enables Ingress, does not publish a host port and reserves `/data` for persistent app data. It ships as a prebuilt multi-architecture image (`ghcr.io/mariomh8/ha-finassists`) that CI publishes, so Home Assistant pulls it instead of building on the device; `docker build -t ha-finassists .` reproduces it locally. The Supervisor mounts `/data` as root, so the container entrypoint prepares that folder and drops to the unprivileged `bun` user; the pre-backup hook runs with the same user. The add-on's `supervisor_ip` option defaults to Home Assistant's standard Supervisor address; override it for non-standard networks. `SUPERVISOR_IP` can override the option when running the container directly, and an invalid address fails startup.

The custom integration under `custom_components/ha_finassists` is installed through HACS or by copying it into Home Assistant's `custom_components` directory. Its config flow accepts only Supervisor `hassio` discovery: the app publishes a one-time bootstrap capability with a 15-minute expiry, Home Assistant asks the user to confirm, and the integration exchanges that capability for a dedicated long-lived system credential. The credential can be rotated from the integration options and is revoked when the entry is removed. Manual setup and pasted capabilities are intentionally unsupported. The details are in [the system credential ADR](docs/adr/0006-home-assistant-system-credential.md), [the identity and token ADR](docs/adr/0004-home-assistant-identity-and-tokens.md) and [the credential lifecycle notes](docs/system-credential-lifecycle.md).

## Tests and checks

CI runs lint, type-check and tests as separate jobs. Before opening a pull request:

```sh
bun run lint:ci && bun run typecheck && bun run test && bun run check:version
```

Tests use Bun's built-in runner and live next to the source as `*.test.ts` files; React components are tested through server rendering. The JavaScript commands do not exercise the Python integration, which has its own offline tests for discovery handling and credential lifecycle, plus syntax and metadata checks. Live Supervisor discovery, config entry setup and removal, HACS installation and card rendering still need validation against a supported Home Assistant/Supervisor installation.

Git hooks run through Husky: lint-staged before committing, Commitlint on the message, and type-check, tests and lint before pushing.

## Branches, commits and pull requests

- `main` is the default and only long-lived branch.
- Create feature and maintenance branches from `main` and open pull requests back to `main`.
- Commit messages follow Conventional Commits.
- Link pull requests to an approved issue with `Closes #123` and add one `type:*` label.
- Add a changeset with `bun changeset add` when the pull request changes what users get. Tooling, CI and documentation changes do not need one.

The details are in [branches and commits](docs/agents/branches-and-commits.md) and the [pull request guide](docs/agents/pull-requests.md).

## Upgrading from a larger build

Starting a build that implements the minimal ledger drops the old financial tables (books, accounts, transactions, …) on first start. API tokens and the Home Assistant system credential are preserved.

## License

Fin Assist is released under the [MIT license](LICENSE). By contributing you agree that your contributions are licensed under the same terms.

## Further reading

- [Architecture](docs/agents/architecture.md) and [conventions](docs/agents/conventions.md).
- [Glossary](CONTEXT.md) of the domain vocabulary.
- [Decision records](docs/adr/) for the choices behind storage, identity, transport and UI.
