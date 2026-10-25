# Branches and commits

## Branches

- `main` is the default and only long-lived branch.
- Create feature and maintenance branches from `main` and open pull requests back to `main`.
- Use `feat/*`, `fix/*`, `docs/*`, `chore/*`, and `refactor/*` prefixes.
- The `Protected branches` ruleset protects `main`: pull requests, verified signatures, and the CI checks are required. Repository administrators retain an emergency bypass.

## Commit convention

Commit messages follow Conventional Commits through `commitlint.config.ts`. Use the configured `commitlint` package script or the commit-message hook in a Git-enabled checkout.

## Changesets

`package.json` is the single source of the product version; `config.yaml` and `custom_components/ha_finassists/manifest.json` repeat it because the Supervisor and HACS read it from their own file. Add a changeset with `bun changeset add` for every pull request that changes what users get; the release tooling calculates the version and runs `bun sync-version.ts` for you. Run `bun run check:version` to verify the three files agree. See [the release process](release-process.md).

## Husky / git hooks

| Hook | Command | Purpose |
| --- | --- | --- |
| `commit-msg` | `bun run commitlint ${1}` | Validate the proposed commit message. |
| `pre-commit` | `bun lint-staged` | Run configured staged-file lint and tests. |
| `pre-push` | `bun run typecheck`, `bun run test`, `bun run lint:fix` | Validate types and tests, then apply lint fixes. |

Husky installs these hooks through the `prepare` script; run `bun install` to activate them in a checkout.
