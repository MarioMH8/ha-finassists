# Conventions

## Runtime and package management

Use Bun for installation, development, builds, tests, and runtime. Keep runtime dependencies minimal; React and React DOM are the application runtime dependencies. TypeScript and tooling packages are development dependencies in `package.json`.

## TypeScript

Both TypeScript configs extend `@hexadrop/tsconfig`, which turns on the strictest checks (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, unused locals and parameters, verbatim module syntax) and emits nothing. The only override is `noPropertyAccessFromIndexSignature`, because CSS Modules resolve to an index signature and the UI reads `styles.card`. The `ha-finassists` workspace package owns the app: keep its server code and React UI source under `ha-finassists/src/`. The root `tsconfig.json` covers the app and the release scripts for typed linting, and `ha-finassists/tsconfig.json` is the one the build uses. Development serves a client bundle compiled in memory; production bundles the server and client into the generated `ha-finassists/dist/` directory.

## Module boundaries

Keep HTTP routing and web asset delivery in `ha-finassists/src/modules/api/infrastructure/http/`; delegate application behavior to its owning module. Register new repositories and use cases in `ha-finassists/src/app-container.ts` (InferDI) and resolve them in routes through `c.var.di`; do not instantiate them inside routes. Keep Home Assistant actor types in `ha-finassists/src/modules/home-assistant/domain/` and Supervisor-specific identity resolution in `ha-finassists/src/modules/home-assistant/infrastructure/ingress/`. Cross-module imports use the `@modules/*` alias, and UI imports use `@app/*`; within a layer, prefer relative imports through that layer's barrel when crossing a layer boundary. Avoid treating user-provided identity headers as trusted without validating the request peer; development mocks must remain opt-in through development configuration.

## Repository configuration

`package.json` is the source of truth for supported commands and dependencies. The lockfile is `bun.lock`; update it with Bun when dependencies change. Commit messages use the Conventional Commits configuration in `commitlint.config.ts`.
