# Development

Use the narrowest command that validates the changed behavior. CI runs lint, type-check, and tests as separate jobs in one command matrix.

## Commands

The repository is a Bun workspace: `ha-finassists` is the app package and Home Assistant app, and the root only keeps the workspace manifest, the integration and the release tooling. Run every command below from the repository root; the ones marked as app scripts delegate to the package with `bun run --filter ha-finassists <script>`.

| Task | Command |
| --- | --- |
| Install locked dependencies | `bun install --frozen-lockfile` |
| Start with file watching and mock Ingress identity | `bun run dev` |
| Build production server and browser assets | `bun run build` |
| Build only the server | `bun run --filter ha-finassists build:server` |
| Build only the browser bundle | `bun run --filter ha-finassists build:web` |
| Start the production build | `bun run start` |
| Lint without modifying files | `bun run lint:ci` |
| Fix lint findings | `bun run lint:fix` |
| Type-check | `bun run typecheck` |
| Run tests | `bun run test` |
| Add a changeset for the pull request | `bun changeset add` |
| Bump the version and sync every manifest | `bun run version` |
| Verify the manifests match the app `package.json` | `bun run check:version` |
| Build the app image locally | `docker build -f ha-finassists/Dockerfile -t ha-finassists .` |

Copy `ha-finassists/.env.example` to `ha-finassists/.env` to configure a local mock actor; Bun loads it from the app package. Development writes its SQLite file to `ha-finassists/data/`. Both are ignored by Git. `bun run dev` uses that actor and bypasses the Supervisor peer check; production rejects development identity variables and validates the trusted peer. Tests use Bun's built-in test runner and are colocated with the source as `*.test.ts` files.

## Continuous integration

`.github/workflows/ci.yml` runs `lint:ci`, `typecheck`, `test`, and `check:version` independently on pushes and pull requests. ESLint's content-based cache is restored for the lint job.

## Git hooks

When Husky is active in a Git checkout, the pre-commit hook runs lint-staged, the commit-message hook runs Commitlint, and the pre-push hook runs type-checking, tests, and lint fixes. The current folder-backed workspace has no Git metadata, so Husky cannot activate these hooks here.
