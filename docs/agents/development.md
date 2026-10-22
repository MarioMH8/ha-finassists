# Development

Use the narrowest command that validates the changed behavior. CI runs lint, type-check, and tests as separate jobs in one command matrix.

## Commands

| Task | Command |
| --- | --- |
| Install locked dependencies | `bun install --frozen-lockfile` |
| Start with file watching | `bun run dev` |
| Start the service | `bun run start` |
| Lint without modifying files | `bun run lint:ci` |
| Fix lint findings | `bun run lint:fix` |
| Type-check | `bun run typecheck` |
| Run tests | `bun run test` |

Set `SUPERVISOR_IP` when running locally if the request peer differs from the default Supervisor address. Tests use Bun's built-in test runner and are colocated with the source as `*.test.ts` files.

## Continuous integration

`.github/workflows/ci.yml` runs `lint:ci`, `typecheck`, and `test` independently on pushes and pull requests. ESLint's content-based cache is restored for the lint job.

## Git hooks

When Husky is active in a Git checkout, the pre-commit hook runs lint-staged, the commit-message hook runs Commitlint, and the pre-push hook runs type-checking, tests, and lint fixes. The current folder-backed workspace has no Git metadata, so Husky cannot activate these hooks here.
