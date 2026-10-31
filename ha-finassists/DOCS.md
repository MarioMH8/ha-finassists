# Fin Assist

Fin Assist keeps a household ledger inside Home Assistant. This page covers running the app. For the dashboard sensors, the
services and the Lovelace card, install the [integration](https://github.com/MarioMH8/ha-finassists#readme).

## Installation

1. In Home Assistant, open **Settings → Apps → Install app**, select **⋮ → Repositories** and add
   `https://github.com/MarioMH8/ha-finassists`.
2. Install **Fin Assist** and start it. Pick your currency during installation; it applies to every amount in the ledger.
3. Open it from the sidebar. Nothing else is needed to use the web interface.
4. Optional, and recommended: install the integration through HACS so Home Assistant discovers the app and adds the
   sensors, the services and the card.

The app needs the Home Assistant Supervisor. It does not run on Home Assistant Container or Home Assistant Core.

## Requirements

- Home Assistant OS or Home Assistant Supervised, with a 64-bit architecture (`amd64` or `aarch64`).
- About 150 MB of disk for the image, plus your ledger.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `supervisor_ip` | Home Assistant's Supervisor address (`172.30.32.2`) | The only address whose Ingress headers the app trusts. Set it when the Supervisor runs somewhere unusual. |
| `application_name` | Fin Assist | Name shown in the interface and in the browser tab. |
| `currency` | EUR | ISO 4217 code applied to every amount. Changing it does not convert amounts that are already recorded. |
| `administration` | `true` | Show the Administration section and personal API token management. Existing tokens keep working when hidden. |
| `month_summary` | `true` | Show the “This month” summary in Transactions. |
| `month_summary_chart` | `true` | Show the six-month chart inside the summary. It is hidden when `month_summary` is off. |
| `scheduled_summary` | `true` | Show the “Upcoming 30 days” forecast in Scheduled. |
| `scheduled_pending` | `true` | Show the list of manual scheduled movements waiting for confirmation. |

`SUPERVISOR_IP` overrides `supervisor_ip` when the container runs outside Home Assistant. An invalid address stops startup.

### Interface flags

The interface flags hide parts of the web app without deleting data or changing the API, MCP server or Home Assistant integration. They default to `true`, so updating the app does not change the interface until you turn one off. Save the options and restart the app for a change to apply.

Hiding Administration removes the place where you create and revoke personal API tokens. Those tokens, the REST API and MCP keep working; turn the option back on when you need to manage them. Hiding the summary or the chart only affects the web interface. Scheduled movements remain managed by the app, its API and the integration; these flags do not stop automatic posting.

## Network

The app listens on port `8099` inside its container and is reached through Ingress, so no host port is published by
default. You can enable `8099/tcp` in the app configuration if you want to reach the API directly from your network; it is
not needed for normal use.

The app exposes a REST API under `/api/v1` and an MCP server under `/mcp` for scripts and assistants. Each person issues
their own revocable token in **Administration** inside the app. Both require a bearer token.

## Data and backups

Everything lives in `/data/fin-assist.sqlite`, inside the app's private data folder:

- Home Assistant backups include `/data`, so the ledger is part of your normal backup.
- Before a hot backup, the app checkpoints the SQLite write-ahead log so the copied file is consistent.
- Uninstalling the app removes that folder. Take a backup first if you want to keep the ledger.

## Discovery and the integration

The app publishes a one-time discovery capability through the Supervisor at startup. Home Assistant asks you to confirm
it, and the integration exchanges the capability for its own long-lived credential. There is no URL to type and no token
to paste.

If discovery does not appear:

1. Confirm the integration is installed and Home Assistant has been restarted since.
2. Restart the app. The capability is published again on startup and expires after 15 minutes.
3. Confirm the app and Home Assistant run on the same Supervisor.

## Troubleshooting

- **The interface asks for authentication or shows a blank page.** The app only accepts Ingress requests from the
  Supervisor address in `supervisor_ip`. Check that option if you use a custom network.
- **The app stops at startup with an address error.** `SUPERVISOR_IP` or `supervisor_ip` is not a valid IP address.
- **Amounts show the wrong symbol.** Set `currency` to the correct ISO 4217 code and restart the app.

The app log (**Settings → Apps → Fin Assist → Log**) names the failing piece. Issues and source code:
[github.com/MarioMH8/ha-finassists](https://github.com/MarioMH8/ha-finassists).

## License

MIT.
