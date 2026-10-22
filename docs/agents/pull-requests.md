# Pull requests

## Issue workflow

- Every pull request must close an issue using a reference such as `Closes #123`.
- The linked issue must remain open and carry the `status:approved` label before the pull request can merge.
- Each pull request must have exactly one `type:*` label. Labels for changed paths are applied automatically.

## Validation

The pull request checks enforce issue approval and type labeling. CI runs `lint:ci`, `typecheck`, and `test`. Required branch protection checks will be configured after their first successful workflow runs establish the exact check names.
