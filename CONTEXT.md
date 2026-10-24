# Fin Assist

This context describes the concepts managed by a Home Assistant household installation. The product is deliberately minimal: it records expenses and incomes only.

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
A dated record of money spent or received, with a kind, a positive amount, and an optional description. Transactions are immutable: they cannot be edited, but they can be deleted, which removes them permanently.
_Avoid_: Operation, entry

**Kind**:
Whether a transaction is an **expense** (money out) or an **income** (money in).
_Avoid_: Type, direction

**Amount**:
A positive integer in the minor units of the installation currency (for example cents). The sign is carried by the kind, never by the amount.

**Currency**:
The single ISO 4217 currency of the installation, configured through the app's `currency` option. Every transaction is stored with the currency in force when it was created; there is no conversion.
