# Branches and commits

## Branches

- `main` is the stable branch; `develop` is the integration branch and repository default.
- Create feature and maintenance branches from `develop` and open pull requests back to `develop`.
- Use `feat/*`, `fix/*`, `docs/*`, `chore/*`, and `refactor/*` prefixes.
- Create hotfixes from `main` and open pull requests to `main`; merge the fix back into `develop` afterward.
- Direct pushes are blocked on `main` and `develop`; commits reaching those branches must have verified signatures and pass all required checks.

## Commit convention

Commit messages follow Conventional Commits through `commitlint.config.ts`. Use the configured `commitlint` package script or the commit-message hook in a Git-enabled checkout.

## Husky / git hooks

| Hook | Command | Purpose |
| --- | --- | --- |
| `commit-msg` | `bun run commitlint ${1}` | Validate the proposed commit message. |
| `pre-commit` | `bun lint-staged` | Run configured staged-file lint and tests. |
| `pre-push` | `bun run typecheck`, `bun run test`, `bun run lint:fix` | Validate types and tests, then apply lint fixes. |

Husky is installed by the `prepare` script when Git metadata is present. The current workspace has no `.git` directory, so hook activation cannot be verified here.
