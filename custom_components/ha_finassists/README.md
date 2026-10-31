# Fin Assist · Home Assistant integration

Connect your [Fin Assist](../../README.md) ledger to Home Assistant: keep this month's totals on a dashboard, log an expense or schedule a recurring one from an automation, and pin the household summary to any Lovelace view.

## What you get

- **Two recorded sensors** that follow the current month: *Income this month* and *Expenses this month*.
- **Three scheduled sensors**: *Scheduled income next 30 days*, *Scheduled expenses next 30 days* and *Scheduled movements due*. They are created only while the app's `scheduled_transactions` capability is enabled.
- **Nine services** to record expenses and incomes, manage scheduled movements, delete a transaction and refresh on demand, with an optional category by name.
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

The card shows this month's recorded income and expenses, the scheduled totals for the next 30 days, how many manual occurrences need confirmation, category breakdowns and a refresh action. Pass `entry_id` to pin it to one integration entry:

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
| Scheduled income next 30 days | Monetary forecast (state class `measurement`) for active scheduled incomes in the next 30 days. |
| Scheduled expenses next 30 days | The same for scheduled expenses. |
| Scheduled movements due | Count of manual scheduled movements whose occurrence is due and still needs confirmation. |

The recorded sensors expose `kind`, `month`, `scope: actual`, `period: current_month`, `integration_entry_id`, `by_category` and `uncategorized`. `by_category` maps each category name to its total for the current month, in major units, and `uncategorized` sums the movements that have no category. Amounts are converted with the currency's real fraction digits, and the unit is the currency reported by the app. Until the month has its first transaction the currency is unknown, so the sensors assume `EUR`.

The scheduled sensors expose `kind`, `scope: scheduled`, `period: next_30_days`, `from_date`, `to_date`, `by_category`, `uncategorized`, `items` and `integration_entry_id`. `items` lists up to ten projected occurrences with `schedule_id`, `due_date`, `kind`, `description`, `amount` and `category`. The due sensor exposes `scope: scheduled_due` and the pending `items`. If the forecast is temporarily unavailable, recorded sensors keep working and the scheduled sensors expose an `error` attribute.

The integration polls every five minutes; the `refresh` service asks for an immediate update. It also reads `GET /api/v1/capabilities` and reloads the config entry when the app changes a capability. When `scheduled_transactions` is off, the scheduled sensors are not created and the scheduled services fail with a clear error. When `categories` is read-only, `GET /categories` keeps working, so services that take a category name and the `by_category` sensor attributes are unchanged. Update the app and the integration together: an older app without the capabilities endpoint is treated as having every capability enabled.

## Services

| Service | Fields |
| --- | --- |
| `ha_finassists.add_expense` | `entry_id`, `amount`, `date` (optional), `description` (optional), `category` (optional) |
| `ha_finassists.add_income` | `entry_id`, `amount`, `date` (optional), `description` (optional), `category` (optional) |
| `ha_finassists.add_scheduled_expense` | `entry_id`, `amount`, `frequency`, `date` (optional), `interval` (optional), `end_date` (optional), `description` (optional), `category` (optional), `automatic` (optional) |
| `ha_finassists.add_scheduled_income` | The same fields as `add_scheduled_expense` |
| `ha_finassists.delete_scheduled_transaction` | `entry_id`, `scheduled_transaction_id` |
| `ha_finassists.post_scheduled_transaction` | `entry_id`, `scheduled_transaction_id` |
| `ha_finassists.skip_scheduled_transaction` | `entry_id`, `scheduled_transaction_id` |
| `ha_finassists.delete_transaction` | `entry_id`, `transaction_id` |
| `ha_finassists.refresh` | `entry_id` (optional) |

`amount` is expressed in major units (`12.50`) and must be greater than zero; extra decimal places are rejected. `date` defaults to today. `category` is a category name that must already exist in Fin Assist and belong to the same kind as the movement; an unknown name fails without recording it. Deletion is permanent and installation-wide.

For scheduled services, `frequency` is one of `once`, `daily`, `weekly`, `monthly` or `yearly`; `interval` repeats every N units (1–999, default 1); `end_date` is an optional inclusive last occurrence; `automatic` defaults to `true`. When `automatic` is `false`, the occurrence waits in *Scheduled movements due* until you call `post_scheduled_transaction` or `skip_scheduled_transaction`.

```yaml
service: ha_finassists.add_expense
data:
  entry_id: YOUR_CONFIG_ENTRY_ID
  amount: 12.50
  description: Mercadona
  category: Groceries
```

```yaml
service: ha_finassists.add_scheduled_expense
data:
  entry_id: YOUR_CONFIG_ENTRY_ID
  amount: 950.00
  date: "2026-05-01"
  frequency: monthly
  description: Rent
  category: Rent
  automatic: true
```

## How it connects

The app publishes a one-time bootstrap capability through Supervisor discovery. When you confirm the setup, the integration exchanges it for a dedicated long-lived *system identity* credential, so automation writes are attributed to the integration rather than to a person. Rotate the credential from the integration options; removing the entry revokes it. The integration never asks for Home Assistant administrator access or elevated Supervisor permissions.

## Status

The integration has offline tests for discovery handling, the credential lifecycle, the REST contract, services and card rendering, plus syntax and metadata checks, but the repository has not yet been validated against a live Home Assistant/Supervisor installation. Discovery delivery, config entry setup and removal, HACS installation, storage-mode resources and card rendering are still pending validation. Issues and reports are welcome in [the issue tracker](https://github.com/MarioMH8/ha-finassists/issues).
