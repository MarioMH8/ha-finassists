# Fin Assist

A self-hosted household-finance app, distributed as one Home Assistant repository. The product is deliberately reduced to its minimum: **record expenses and incomes, nothing else**. It is built with Bun, an Ingress application, REST and MCP, and a native Home Assistant integration, and grows iteratively from this base.

## Quick path

- **Financial domain:** Expenses and incomes only. See [the glossary](../CONTEXT.md).
- **Primary experience:** A theme-aware web app through Home Assistant Ingress to add transactions and see the month at a glance.
- **External interfaces:** A new REST API and a read/write MCP server using Streamable HTTP; both require a user-associated token.
- **Persistence:** One SQLite database in the add-on's persistent storage, included in Home Assistant backups.
- **Distribution:** One repository for the Home Assistant app, custom integration, and card. Use the Add-on Store for the app and HACS for the integration; the integration serves the card as a frontend resource.

## Product scope

Included: creating and listing transactions, each with a kind (expense or income), a positive amount in minor units, an optional description, and a date. One installation-wide currency is set with the app's `currency` option.

Explicitly out of scope for now: accounts and balances, transfers, categories and classes, budgets, scheduled payments, shared expenses, statement imports, multiple books, editing or deleting transactions, and bank synchronization. Each can return later as its own iteration; earlier designs were removed from the code. The REST contract is new and does not need compatibility with the reference Python API.

## Product shape

| Surface | Responsibility |
| --- | --- |
| Home Assistant Ingress app | Add-transaction form, monthly summary, recent transactions, and personal-token management. |
| Bun service | Transaction rules, persistent data, REST API, MCP tools (`create_transaction`, `list_transactions`), token management, and audit attribution. |
| REST API | New contract for the native integration and external local-network clients. |
| MCP | Read and write tools over Streamable HTTP, authenticated with the same personal-token model as REST. |
| Custom Home Assistant integration | Native Home Assistant configuration, monthly income/expense sensors, and add-expense/add-income services. It uses a separate system identity for audit attribution. |
| Lovelace card | A quick view of the month's totals with a refresh action. It is served as a frontend resource by the integration rather than as a second HACS repository category. |

The Ingress UI follows Home Assistant's visual patterns, supports its light/dark themes, and avoids private frontend APIs. The initial UI languages are Spanish and English, selected from Home Assistant's language preference, with English as fallback.

## Financial boundaries

- The installation holds a single household ledger with a single currency; there is no foreign-exchange conversion.
- The data is shared by the household. Home Assistant identities do not divide data or grant different financial permissions.

## Identity, tokens, and audit

- Ingress requests use the Supervisor-provided `X-Remote-User-Id` as the stable user identifier when present. The user name and display name are optional labels, not identity keys.
- Ingress requests without a stable user ID are attributed to an unknown actor; no default user or name-based inference is allowed. A token cannot be issued without a stable ID.
- Every Home Assistant user may create and manage only their own personal API/MCP tokens. Tokens are full read/write credentials with equal permissions. The secret is shown once, may be manually revoked, and has no mandatory expiry. Tokens must not be shared.
- An API/MCP action is audited as the Home Assistant user associated with its token; this indicates the token owner, not necessarily the human currently operating the client.
- The native Home Assistant integration uses a separate system identity named “Home Assistant integration”, so calls from automations are not falsely attributed to an individual.
- Ingress authenticates the browser session, but it does not authenticate external REST/MCP clients. The app must trust identity headers only on requests forwarded by Supervisor. REST/MCP are available to local-network clients with a token; no Internet exposure is configured by default.
- All users who can open Ingress have full financial read/write access. Identity is for attribution, not authorization. Token management is owner-scoped; there is no administrator-only authorization model.

## Delivery

The current release contains only the minimal ledger described above. Further capabilities (for example categories, accounts, or scheduled payments) are added one iteration at a time, each recorded in its own ADR.

## Distribution constraints

The repository is designed to serve as both a Home Assistant add-on repository and a HACS integration repository. HACS publishes one content category per repository; therefore, the dashboard card is shipped and served by the integration rather than registered as a second HACS dashboard repository. The repository targets `amd64` and `aarch64`.

## Reference material

- [my-bank-api](https://github.com/Patafoin/my-bank-api): existing financial API and domain behavior.
- [ha-my-bank](https://github.com/Patafoin/ha-my-bank): existing custom integration and Lovelace card.
- [ha-addons](https://github.com/Patafoin/ha-addons): existing app packaging, discovery, and backup behavior.
- [Home Assistant Ingress guide](https://contributors.home-assistant.io/apps/guides/ingress/): session identity headers, path handling, and Supervisor trust boundary.
- [HACS integration requirements](https://www.hacs.xyz/docs/publish/integration/) and [plugin requirements](https://www.hacs.xyz/docs/publish/plugin/): single-repository category constraint.
