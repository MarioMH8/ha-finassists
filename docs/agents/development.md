# Development

Use the narrowest command that validates the changed behavior. CI runs lint, type-check, and tests as separate jobs in one command matrix.

## Commands

| Task | Command |
| --- | --- |
| Install locked dependencies | `bun install --frozen-lockfile` |
| Start with file watching and mock Ingress identity | `bun run dev` |
| Build production server and browser assets | `bun run build` |
| Build only the server | `bun run build:server` |
| Build only the browser bundle | `bun run build:web` |
| Start the production build | `bun run start` |
| Lint without modifying files | `bun run lint:ci` |
| Fix lint findings | `bun run lint:fix` |
| Type-check | `bun run typecheck` |
| Run tests | `bun run test` |

Copy `.env.example` to `.env` to configure a local mock actor. `bun run dev` uses that actor and bypasses the Supervisor peer check; production rejects development identity variables and validates the trusted peer. Tests use Bun's built-in test runner and are colocated with the source as `*.test.ts` files.

## Continuous integration

`.github/workflows/ci.yml` runs `lint:ci`, `typecheck`, and `test` independently on pushes and pull requests. ESLint's content-based cache is restored for the lint job.

## Git hooks

When Husky is active in a Git checkout, the pre-commit hook runs lint-staged, the commit-message hook runs Commitlint, and the pre-push hook runs type-checking, tests, and lint fixes. The current folder-backed workspace has no Git metadata, so Husky cannot activate these hooks here.
