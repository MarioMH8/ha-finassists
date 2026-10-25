# Conventions

## Runtime and package management

Use Bun for installation, development, builds, tests, and runtime. Keep runtime dependencies minimal; React and React DOM are the application runtime dependencies. TypeScript and tooling packages are development dependencies in `package.json`.

## TypeScript

The TypeScript compiler is configured in strict mode with no emitted output. Keep server code and React UI source under `src/`. Development serves a client bundle compiled in memory; production bundles the server and client into the generated `dist/` directory.

## Module boundaries

Keep HTTP routing and web asset delivery in `src/modules/api/infrastructure/http/`; delegate application behavior to its owning module. Register new repositories and use cases in `src/app-container.ts` (InferDI) and resolve them in routes through `c.var.di`; do not instantiate them inside routes. Keep Home Assistant actor types in `src/modules/home-assistant/domain/` and Supervisor-specific identity resolution in `src/modules/home-assistant/infrastructure/ingress/`. Cross-module imports use the `@modules/*` alias, and UI imports use `@app/*`; within a layer, prefer relative imports through that layer's barrel when crossing a layer boundary. Avoid treating user-provided identity headers as trusted without validating the request peer; development mocks must remain opt-in through development configuration.

## Repository configuration

`package.json` is the source of truth for supported commands and dependencies. The lockfile is `bun.lock`; update it with Bun when dependencies change. Commit messages use the Conventional Commits configuration in `commitlint.config.ts`.
