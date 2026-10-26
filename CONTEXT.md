# Fin Assist

This context describes the concepts managed by a Home Assistant household installation. The product is deliberately minimal: it records expenses and incomes, optionally grouped by category.

## People

**Home Assistant user**:
A person with an identity in the Home Assistant installation. A user's identity may be recorded as the actor of an action; it does not determine financial permissions.
_Avoid_: App user

**Personal API token**:
A revocable credential owned by one Home Assistant user and used to authenticate that user's external REST or MCP requests. The token owner is the actor for those requests; users manage only their own tokens.
_Avoid_: API key (unless referring to a different credential type), session token

**Actor**:
The person or system identity recorded as responsible for a transaction; it may be unknown.
_Avoid_: Operator (when the action came from an automation or reusable credential)

## Financial records

**Transaction**:
A dated record of money spent or received, with a kind, a positive amount, an optional category and an optional description. A transaction can be corrected or deleted; deleting removes it permanently.

**Category**:
A named grouping of transactions of one kind, for example **Groceries** or **Salary**. Categories are flat (there is no hierarchy), their names are unique within their kind, and a transaction may only use a category of its own kind. A category with transactions cannot be renamed to another kind or deleted, so history is never rewritten silently.
_Avoid_: Tag, label, bucket

**Kind**:
Whether a transaction is an **expense** (money out) or an **income** (money in). A category belongs to exactly one kind.
_Avoid_: Type, direction

**Scheduled transaction**:
A planned expense or income that has not been recorded yet. It holds a kind, a positive amount, an optional category and description, a first date, an optional recurrence and a posting mode. It becomes a normal **transaction** when posted.
_Avoid_: Future transaction, pending payment (when referring to the template)

**Recurrence**:
The rule that repeats a scheduled transaction: once, every N days, every N weeks, every N months or every N years, optionally until an end date. It is anchored to the first date, so month-end dates are clamped rather than drifting.
_Avoid_: Period, interval alone

**Posting**:
Turning the next occurrence of a scheduled transaction into a transaction. It may happen automatically when the date arrives or manually when a person confirms it.
_Avoid_: Executing, paying

**Forecast**:
The scheduled movements projected over a date range. It is shown separately from recorded totals and never counts as money already spent or received.
_Avoid_: Budget, projection total

**Amount**:
A positive integer in the minor units of the installation currency (for example cents). The sign is carried by the kind, never by the amount.

**Currency**:
The single ISO 4217 currency of the installation, configured through the app's `currency` option. Every transaction is stored with the currency in force when it was created; there is no conversion.
