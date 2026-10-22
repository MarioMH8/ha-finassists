# Branches and commits

## Branches

No branch model or branch naming convention is configured in this folder-backed workspace.

## Commit convention

Commit messages follow Conventional Commits through `commitlint.config.ts`. Use the configured `commitlint` package script or the commit-message hook in a Git-enabled checkout.

## Husky / git hooks

| Hook | Command | Purpose |
| --- | --- | --- |
| `commit-msg` | `bun run commitlint ${1}` | Validate the proposed commit message. |
| `pre-commit` | `bun lint-staged` | Run configured staged-file lint and tests. |
| `pre-push` | `bun run typecheck`, `bun run test`, `bun run lint:fix` | Validate types and tests, then apply lint fixes. |

Husky is installed by the `prepare` script when Git metadata is present. The current workspace has no `.git` directory, so hook activation cannot be verified here.
