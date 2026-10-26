# Pull requests

## Issue workflow

- Every pull request must close an issue using a reference such as `Closes #123`.
- The linked issue must remain open and carry the `status:approved` label before the pull request can merge.
- Each pull request must have exactly one `type:*` label. Labels for changed paths are applied automatically.
- Pull requests labeled `internal:*` are exempt from the issue, type and changeset checks. Use them for repository tooling that has no product issue.
- A pull request labeled `type:bug`, `type:feature` or `type:refactor` must include a changeset (`bun changeset add`). Tooling, CI and documentation pull requests (`type:chore`, `type:docs`, `type:breaking-change`) do not need one. See [the release process](release-process.md).

## Validation

The shared [`hexadrop/validate-pr-action@v1.0.1`](https://github.com/hexadrop/validate-pr-action/releases/tag/v1.0.1) checks issue approval, open state, type labeling, and the presence of a changeset. The `release` and `internal:*` labels are exempt: `release` lets the automated release pull request through, and `internal:*` covers repository tooling that has no product issue. [PR #53](https://github.com/hexadrop/validate-pr-action/pull/53) added linked-issue open-state validation to the shared action, keeping this policy centralized.

CI calls the shared `hexadrop/github-workflows` check workflow to run `lint:ci`, `typecheck`, `test`, and `check:version` on `main`. The `Protected branches` ruleset requires these checks before merging.

Release pull requests are created by `release-prepare.yml` and merged by a maintainer. They must not be edited by hand: the version and the manifests come from `bun run version`.
