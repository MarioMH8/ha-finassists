# Fin Assist

A self-hosted household-finance app, distributed as one Home Assistant repository. The target product keeps the financial capabilities of the reference project while replacing its backend with Bun, adding an Ingress application and MCP, and retaining native Home Assistant integration and dashboard experiences.

## Quick path

- **Financial domain:** Full feature parity is the target, delivered in phases. See [the glossary](../CONTEXT.md).
- **Primary experience:** A complete, theme-aware web app through Home Assistant Ingress.
- **External interfaces:** A new REST API and a read/write MCP server using Streamable HTTP; both require a user-associated token.
- **Persistence:** One SQLite database in the add-on's persistent storage, included in Home Assistant backups.
- **Distribution:** One repository for the Home Assistant app, custom integration, and card. Use the Add-on Store for the app and HACS for the integration; the integration serves the card as a frontend resource.

## Product scope

The target includes the reference system's financial capabilities:

- Accounts and their total, posted, and reconciled balances.
- Transactions with statuses and categorized parts, plus transfers between accounts.
- Hierarchical categories and classes.
- Scheduled payments, budgets, and shared expenses.
- Manual QIF and CSV statement imports.

There is no live bank connection in the reference scope. Bank synchronization is intentionally out of scope. The new REST contract may be simpler, but it does not need to preserve compatibility with the Python API's existing `/api/v1` clients.

## Product shape

| Surface | Responsibility |
| --- | --- |
| Home Assistant Ingress app | Full financial management UI, including books, accounts, transactions, imports, and later-phase modules. |
| Bun service | Financial rules, persistent data, REST API, MCP tools, token management, and audit attribution. |
| REST API | New contract for the native integration and external local-network clients. |
| MCP | Explicit read and write tools over Streamable HTTP, authenticated with the same personal-token model as REST. |
| Custom Home Assistant integration | Native Home Assistant configuration and entities/actions, delivered in the final phase. It uses a separate system identity for audit attribution. |
| Lovelace card | A quick-view and common-actions surface, delivered alongside the integration. It is served as a frontend resource by the integration rather than as a second HACS repository category. |

The Ingress UI follows Home Assistant's visual patterns, supports its light/dark themes, and avoids private frontend APIs. The initial UI languages are Spanish and English, selected from Home Assistant's language preference, with English as fallback.

## Books and financial boundaries

- Each installation creates one financial book by default. Users can create more books from the UI.
- Every book is isolated: accounts, transactions, categories/classes, budgets, schedules, imports, and shared expenses do not cross book boundaries.
- Each book has one currency. Accounts and budgets use that currency; no automatic foreign-exchange conversion is included.
- The UI remembers the selected book independently per user/browser. REST and MCP calls must name a book when no explicit request context selects one.
- A book with data can be archived; only an empty book can be deleted.
- The data is shared by the household. Home Assistant identities do not divide books or grant different financial permissions.

## Identity, tokens, and audit

- Ingress requests use the Supervisor-provided `X-Remote-User-Id` as the stable user identifier when present. The user name and display name are optional labels, not identity keys.
- Ingress requests without a stable user ID are attributed to an unknown actor; no default user or name-based inference is allowed. A token cannot be issued without a stable ID.
- A user becomes available as a shared-expense participant after their first Ingress access. The participant and the actor who records an expense are distinct concepts, even when they refer to the same Home Assistant user.
- Every Home Assistant user may create and manage only their own personal API/MCP tokens. Tokens are full read/write credentials with equal permissions across books. The secret is shown once, may be manually revoked, and has no mandatory expiry. Tokens must not be shared.
- An API/MCP action is audited as the Home Assistant user associated with its token; this indicates the token owner, not necessarily the human currently operating the client.
- The native Home Assistant integration uses a separate system identity named “Home Assistant integration”, so calls from automations are not falsely attributed to an individual.
- Ingress authenticates the browser session, but it does not authenticate external REST/MCP clients. The app must trust identity headers only on requests forwarded by Supervisor. REST/MCP are available to local-network clients with a token; no Internet exposure is configured by default.
- All users who can open Ingress have full financial read/write access. Identity is for attribution and expense participation, not authorization. Token management is owner-scoped; there is no administrator-only authorization model.

## Delivery phases

1. **Core:** Books; accounts and balances; transactions and transfers; QIF/CSV import; complete Ingress UI; REST API; read/write MCP; SQLite persistence and Home Assistant backup support.
2. **Financial planning:** Budgets, scheduled payments, and shared expenses with Home Assistant-user participants.
3. **Home Assistant-native experience:** Custom integration and Lovelace quick-view/common-actions card, distributed from the same repository.

The final product includes all three phases. Phase boundaries are sequencing decisions, not permanent scope exclusions.

## Distribution constraints

The repository is designed to serve as both a Home Assistant add-on repository and a HACS integration repository. HACS publishes one content category per repository; therefore, the dashboard card is shipped and served by the integration rather than registered as a second HACS dashboard repository. The repository targets `amd64` and `aarch64`.

## Reference material

- [my-bank-api](https://github.com/Patafoin/my-bank-api): existing financial API and domain behavior.
- [ha-my-bank](https://github.com/Patafoin/ha-my-bank): existing custom integration and Lovelace card.
- [ha-addons](https://github.com/Patafoin/ha-addons): existing app packaging, discovery, and backup behavior.
- [Home Assistant Ingress guide](https://contributors.home-assistant.io/apps/guides/ingress/): session identity headers, path handling, and Supervisor trust boundary.
- [HACS integration requirements](https://www.hacs.xyz/docs/publish/integration/) and [plugin requirements](https://www.hacs.xyz/docs/publish/plugin/): single-repository category constraint.
