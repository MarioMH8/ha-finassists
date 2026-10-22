# Fin Assist

This context describes the financial concepts managed by a Home Assistant household installation.

## Books and people

**Financial book**:
An isolated collection of a household's financial records, including its accounts, transactions, categories, budgets, schedules, and shared expenses. An installation has one book by default and may contain more.
_Avoid_: Ledger, household (when referring to the collection itself)

**Home Assistant user**:
A person with an identity in the Home Assistant installation. A user's identity may be recorded as the actor of an action or linked to a shared-expense participant; it does not determine financial permissions.
_Avoid_: App user, account owner (unless specifically referring to a financial account owner)

**Personal API token**:
A revocable credential owned by one Home Assistant user and used to authenticate that user's external REST or MCP requests. The token owner is the actor for those requests; users manage only their own tokens.
_Avoid_: API key (unless referring to a different credential type), session token

**Actor**:
The person or system identity recorded as responsible for a financial action; it may be unknown.
_Avoid_: Operator (when the action came from an automation or reusable credential)

**Shared-expense participant**:
A Home Assistant user who is included in the allocation or settlement of a shared expense. The participant is distinct from the actor who records or changes that expense.
_Avoid_: Payer (unless specifically identifying who paid)

## Financial records

**Account**:
A financial account within one book, with its own balance and associated transactions.
_Avoid_: Book

**Transaction**:
A dated financial record affecting an account, with a status and one or more categorized parts where applicable.
_Avoid_: Operation

**Transfer**:
A movement of value between two accounts in the same book, represented as a linked financial event rather than unrelated income and expense.
_Avoid_: Payment (unless referring to a scheduled payment)

**Category**:
A hierarchical label used to classify financial activity.
_Avoid_: Class

**Class**:
A separate hierarchical dimension for classifying financial activity, distinct from a category.
_Avoid_: Category

**Scheduled payment**:
A planned future or recurring payment record that can be used to anticipate financial activity.
_Avoid_: Transaction (until it is recorded as one)

**Budget**:
A planned limit or allocation for spending over a defined period, associated with a book's categories or other supported classification.
_Avoid_: Scheduled payment

**Shared expense**:
A financial expense whose amount or settlement is allocated among multiple participants.
_Avoid_: Transfer (unless funds actually move between accounts)
