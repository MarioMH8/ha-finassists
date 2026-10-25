# Pull requests

## Issue workflow

- Every pull request must close an issue using a reference such as `Closes #123`.
- The linked issue must remain open and carry the `status:approved` label before the pull request can merge.
- Each pull request must have exactly one `type:*` label. Labels for changed paths are applied automatically.

## Validation

The shared [`hexadrop/validate-pr-action@v1.0.1`](https://github.com/hexadrop/validate-pr-action/releases/tag/v1.0.1) checks issue approval, open state, and type labeling. [PR #53](https://github.com/hexadrop/validate-pr-action/pull/53) added linked-issue open-state validation to the shared action, keeping this policy centralized. CI calls the shared `hexadrop/github-workflows` check workflow to run `lint:ci`, `typecheck`, and `test` on `main`. No branch ruleset currently requires these checks.
