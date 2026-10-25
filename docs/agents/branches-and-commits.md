# Branches and commits

## Branches

- `main` is the default and only long-lived branch.
- Create feature and maintenance branches from `main` and open pull requests back to `main`.
- Use `feat/*`, `fix/*`, `docs/*`, `chore/*`, and `refactor/*` prefixes.
- No branch rulesets are configured for now; CI still runs on pushes and pull requests targeting `main`.

## Commit convention

Commit messages follow Conventional Commits through `commitlint.config.ts`. Use the configured `commitlint` package script or the commit-message hook in a Git-enabled checkout.

## Husky / git hooks

| Hook | Command | Purpose |
| --- | --- | --- |
| `commit-msg` | `bun run commitlint ${1}` | Validate the proposed commit message. |
| `pre-commit` | `bun lint-staged` | Run configured staged-file lint and tests. |
| `pre-push` | `bun run typecheck`, `bun run test`, `bun run lint:fix` | Validate types and tests, then apply lint fixes. |

Husky installs these hooks through the `prepare` script; run `bun install` to activate them in a checkout.
