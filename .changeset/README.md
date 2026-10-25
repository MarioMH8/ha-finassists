# Changesets

Every pull request that changes what someone using Fin Assist gets ships a changeset: a small Markdown file that
declares the impact (`patch`, `minor` or `major`) and the line the release notes should show.

```sh
bun changeset add
```

The `chore: release v<version>` pull request turns the pending changesets into a single version, a changelog entry and
synchronized Home Assistant manifests. Tooling, CI and documentation changes ship without a changeset.

See [the release process](../docs/agents/release-process.md) for the full flow.
