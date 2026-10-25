# Deleting transactions

Transactions stay immutable: a recorded transaction is never edited in place, because its amount, kind and date are the facts the monthly totals are derived from. Deletion is the only correction path, and it removes the row permanently rather than hiding it behind a soft-delete flag. A soft delete would force every read path — the REST list, the MCP tool, the monthly summary and the Home Assistant sensors — to filter deleted rows, and the product has no audit or restore requirement that would justify that cost.

Deletion is exposed on every surface that already writes transactions: the Ingress UI, `DELETE /api/v1/transactions/{transactionId}`, the `delete_transaction` MCP tool, and the `ha_finassists.delete_transaction` service. All of them call the same `DeleteTransaction` use case, so the rules live in one place.

A missing transaction is reported as `404` rather than treated as an idempotent success, so a client that deletes the wrong identifier learns about it instead of silently succeeding. Deletion is installation-wide: transactions carry no per-actor ownership, so any valid token can delete any transaction, matching the existing read and write permissions. The UI asks for confirmation before calling the API, but that confirmation is a client-side safeguard, not an authorization boundary.
