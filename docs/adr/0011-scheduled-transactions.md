# Scheduled transactions

A scheduled transaction is a template, not a transaction. It stores the kind, amount, currency, category and description that future transactions will use, plus a first date, a recurrence and a posting mode. It becomes a normal transaction only when it is posted, so the recorded ledger never contains amounts that have not happened.

## Recurrence

A schedule repeats once, every N days, every N weeks, every N months or every N years. The recurrence is anchored to the first date: a monthly schedule that starts on 31 January falls on 28 or 29 February and returns to 31 March. An optional end date is inclusive. There is no business-day adjustment; a household that needs a payment moved for a weekend creates the appropriate date in the schedule or edits the generated transaction.

Editing the recurrence, the first date or the end date recalculates the next occurrence from today and does not replay past occurrences. Editing the amount, category, description, kind or posting mode applies to future occurrences. Posted transactions are independent records: editing or deleting the schedule never rewrites them.

## Posting

Automatic schedules are posted by a server job that runs at startup and periodically. If the app was stopped, the job catches up every occurrence through the current calendar date with its original due date, in bounded batches. A paused schedule does not post; resuming skips the occurrences that became due while it was paused so a household never receives months of transactions at once.

Manual schedules wait for confirmation. The next occurrence is exposed as pending and can be posted or skipped. A manual post is attributed to the actor who confirmed it; an automatic post is attributed to the actor who created the schedule. The transaction date is always the due date, not the date the job ran.

Posting writes the transaction and advances the schedule in one SQLite transaction. The `(schedule_id, schedule_occurrence_number)` unique index makes retries idempotent, and an optimistic version on the schedule prevents an edit from overwriting a concurrent posting.

## Scheduling

The posting job is an application service over a `Scheduler` port. The Bun adapter uses the in-process `Bun.cron` overload with the Home Assistant time zone, a 15-minute expression and `unref()`; it is not durable and dies with the process, so the startup immediate run and catch-up remain the recovery path. The OS-level cron overload is deliberately not used because it would write scheduler state outside the app's data and depend on a host daemon.

## Boundaries

The scheduled forecast is separate from the recorded monthly totals. It includes active schedules in the installation currency only. A category referenced by a schedule cannot be deleted, and changing its kind is blocked while schedules use it. Deleting a schedule keeps its posted transactions.

Dates are calendar dates. The server resolves "today" from the Home Assistant `TZ` environment so the automatic job changes day with the household, not with UTC. The app, REST API, MCP tools and Home Assistant integration all call the same use cases.
