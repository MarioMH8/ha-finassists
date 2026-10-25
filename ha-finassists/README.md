# Fin Assist

Household finances inside Home Assistant. Record income and expenses in seconds, see the month at a glance, and keep one private ledger in your own instance: no cloud, no subscription.

- **Opens from the sidebar.** The app runs behind Home Assistant Ingress, so there is no port to remember.
- **Your data stays home.** One SQLite file in `/data`, included in your Home Assistant backups.
- **One ledger for the household.** Search, filter, edit and delete transactions from the web interface or from automations.

This app is the ledger, the API and the web interface. Install the [Fin Assist integration](https://github.com/MarioMH8/ha-finassists#readme) through HACS to add the dashboard sensors, the automation services and the Lovelace card.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `supervisor_ip` | Home Assistant's Supervisor address | Address the app trusts for Ingress requests. Change it only on a non-standard network. |
| `application_name` | Fin Assist | Name shown in the interface. |
| `currency` | EUR | ISO 4217 currency code used for every amount. |

The **Documentation** tab covers installation, data, backups and troubleshooting. Source code, issues and the integration live at [github.com/MarioMH8/ha-finassists](https://github.com/MarioMH8/ha-finassists).

Fin Assist is released under the MIT license.
