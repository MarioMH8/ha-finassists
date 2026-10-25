# Fin Assist · Home Assistant integration

Connect your [Fin Assist](../../README.md) ledger to Home Assistant: keep this month's totals on a dashboard, log an expense from an automation, and pin the household summary to any Lovelace view.

## What you get

- **Two sensors** that follow the current month: *Income this month* and *Expenses this month*.
- **Four services** to record expenses, record incomes, delete a transaction and refresh on demand.
- **A Lovelace card** bundled with the integration, so there is nothing extra to download.

## Install

1. **Install and start the Fin Assist app.** In Home Assistant, open **Settings → Add-ons → Add-on Store**, select **⋮ → Repositories**, add `https://github.com/MarioMH8/ha-finassists`, then install and start **Fin Assist**. Pick your currency while installing.
2. **Add the integration.** In **HACS → Integrations → ⋮ → Custom repositories**, add the same URL as an **Integration**, install **Fin Assist** and restart Home Assistant.
3. **Confirm the discovery.** The running app announces itself through Supervisor. Home Assistant opens a confirmation step — accept it and the integration is ready.

The integration only accepts Supervisor discovery: there is no manual setup, no URL to type and no token to paste.

## The card

```yaml
type: custom:fin-assist-card
```

The integration serves the card at `/ha_finassists/fin-assist-card.js`. In a YAML-mode dashboard, declare it as a module resource:

```yaml
lovelace:
  resources:
    - url: /ha_finassists/fin-assist-card.js
      type: module
```

In a storage-mode dashboard, add that path as a **JavaScript module** resource under **Settings → Dashboards → Resources**. Automatic registration is intentionally not implemented: it would require private frontend APIs.

The card shows this month's income and expenses and offers a refresh action. Pass `entry_id` to pin it to one integration entry:

```yaml
type: custom:fin-assist-card
entry_id: YOUR_CONFIG_ENTRY_ID
```

Without `entry_id` the card totals every entry and refreshes the entry when only one exists.

## Entities

| Entity | Description |
| --- | --- |
| Income this month | Monetary sensor (state class `total`) summing the transactions dated in the current calendar month. |
| Expenses this month | The same for money spent. |

Both belong to one Fin Assist device per config entry and expose `kind`, `month` and `integration_entry_id` attributes. Amounts are converted with the currency's real fraction digits, and the unit is the currency reported by the app. Until the month has its first transaction the currency is unknown, so the sensors assume `EUR`.

The integration polls every five minutes; the `refresh` service asks for an immediate update.

## Services

| Service | Fields |
| --- | --- |
| `ha_finassists.add_expense` | `entry_id`, `amount`, `date` (optional), `description` (optional) |
| `ha_finassists.add_income` | `entry_id`, `amount`, `date` (optional), `description` (optional) |
| `ha_finassists.delete_transaction` | `entry_id`, `transaction_id` |
| `ha_finassists.refresh` | `entry_id` (optional) |

`amount` is expressed in major units (`12.50`) and must be greater than zero; extra decimal places are rejected. `date` defaults to today. Deletion is permanent and installation-wide.

```yaml
service: ha_finassists.add_expense
data:
  entry_id: YOUR_CONFIG_ENTRY_ID
  amount: 12.50
  description: Groceries
```

## How it connects

The app publishes a one-time bootstrap capability through Supervisor discovery. When you confirm the setup, the integration exchanges it for a dedicated long-lived *system identity* credential, so automation writes are attributed to the integration rather than to a person. Rotate the credential from the integration options; removing the entry revokes it. The integration never asks for Home Assistant administrator access or elevated Supervisor permissions.

## Status

The integration has offline tests for discovery handling and the credential lifecycle, plus syntax and metadata checks, but the repository has not yet been validated against a live Home Assistant/Supervisor installation. Discovery delivery, config entry setup and removal, HACS installation, storage-mode resources and card rendering are still pending validation. Issues and reports are welcome in [the issue tracker](https://github.com/MarioMH8/ha-finassists/issues).
