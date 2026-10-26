# Fin Assist agent guide

Fin Assist provides household financial management through Home Assistant.

- **Package manager:** Bun (`bun`)
- **App source:** `ha-finassists/` (workspace package and Home Assistant app)
- **Test:** `bun run test`
- **Type-check:** `bun run typecheck`
- **Lint:** `bun run lint:fix`
- **Comments:** only for non-obvious constraints or workarounds; rationale belongs in ADRs and task guides
- **Changeset:** `bun changeset add` in every pull request that changes what users get

## Task guides

- [Architecture](docs/agents/architecture.md) — application boundaries and Home Assistant distribution.
- [Conventions](docs/agents/conventions.md) — runtime, TypeScript, and repository configuration.
- [Development](docs/agents/development.md) — local commands, tests, and verified CI checks.
- [Release process](docs/agents/release-process.md) — current release and publication state.
- [Pull requests](docs/agents/pull-requests.md) — current contribution workflow and repository policy.
- [Branches and commits](docs/agents/branches-and-commits.md) — commit convention and configured Git hooks.
