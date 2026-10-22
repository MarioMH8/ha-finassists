# Conventions

## Runtime and package management

Use Bun for installation, development, tests, and runtime. Keep runtime dependencies minimal; the current server and web app have no runtime package dependencies. TypeScript and tooling packages are development dependencies in `package.json`.

## TypeScript

The TypeScript compiler is configured in strict mode with no emitted output. Keep server code and React UI source under `src/`; the browser entry point is compiled by Bun into memory at startup and served from the same origin. Do not introduce an on-disk frontend build directory or a separate build command.

## Module boundaries

Keep HTTP routing and web asset delivery in `src/app/http/`. Keep Home Assistant Supervisor-specific identity resolution in `src/platform/ingress/`. Avoid moving trust decisions into route handlers or treating user-provided identity headers as trusted without validating the request peer.

## Repository configuration

`package.json` is the source of truth for supported commands and dependencies. The lockfile is `bun.lock`; update it with Bun when dependencies change. Commit messages use the Conventional Commits configuration in `commitlint.config.ts`.
