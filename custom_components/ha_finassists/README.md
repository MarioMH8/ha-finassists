# Fin Assist Home Assistant integration

This custom integration provides account-balance sensors, finite-schedule summary sensors, refresh and schedule-status services, and a bundled Lovelace card. The implementation is provided for Phase 4, but this repository has not been validated against a live Home Assistant/Supervisor installation; treat the topology and lifecycle acceptance checks below as pending.

## Installation and setup

Install this repository as a HACS **Integration** custom repository, or copy `custom_components/ha_finassists` into Home Assistant's `custom_components/ha_finassists` directory and restart Home Assistant. The root `hacs.json` and integration manifest provide HACS metadata; no release artifact is required for custom-repository installation.

The config flow accepts only Supervisor `hassio` discovery. The add-on must declare the `ha_finassists` discovery domain and send a one-time `bootstrapCapability` in its discovery config. Home Assistant presents a confirmation step before the integration exchanges that capability at `POST /api/v1/system-credentials/exchange`. The integration derives its API host from the validated Supervisor add-on slug on port 8099 and ignores any `baseUrl` supplied through discovery, keeping bootstrap credentials on the internal add-on network. Manual user setup and manually pasted capabilities are intentionally unsupported.

Only the returned long-lived system credential and credential ID are stored in the config entry; neither is placed in discovery data. The adapter uses the authenticated `PUT /api/v1/system-credentials/current` route to rotate the credential when the user reauthenticates or requests rotation in the integration options. Removing an entry makes a best-effort authenticated DELETE to revoke it. Unloading or reloading does not revoke it. The integration does not request Home Assistant administrative API access or elevated Supervisor permissions.

At startup, the add-on generates a random, one-use bootstrap capability, stores only its hash with a 15-minute expiry, and publishes the capability using Supervisor's documented `/discovery` endpoint for the `ha_finassists` domain. It uses only Supervisor's injected token for that endpoint; it does not request elevated Supervisor or Home Assistant API permissions. If publication fails, add-on startup aborts rather than silently leaving the integration undiscoverable. The discovery message omits `baseUrl`, allowing the integration to resolve the add-on from Supervisor's slug, including repository-prefixed local IDs. The long-lived credential is created only after the user confirms setup and is never published through discovery. This end-to-end handoff still requires validation on a live Home Assistant/Supervisor installation.

## Entities and services

- One monetary sensor per open account, with total balance as the value and posted/reconciled values plus account metadata as attributes. Integer minor units are converted using the currency's actual fraction-digit precision.
- One sensor per book counting active or paused finite schedules ending in the next 30 days. When schedule refresh fails, previously available schedule values are retained.
- `ha_finassists.refresh` requests a refresh. `ha_finassists.set_schedule_status` supports `active`, `paused`, and `canceled` for a schedule.
- Polling interval is five minutes. The integration does not create transactions or provide an alternative finance-management UI.

## Lovelace card

The bundled card is served by the integration at `/ha_finassists/fin-assist-card.js`. In a YAML-mode dashboard, add a module resource and a card entry, for example:

```yaml
lovelace:
  resources:
    - url: /ha_finassists/fin-assist-card.js
      type: module
```

```yaml
type: custom:fin-assist-card
```

In storage mode, add `/ha_finassists/fin-assist-card.js` as a JavaScript module resource under **Settings → Dashboards → Resources**. Automatic storage-mode registration is intentionally not implemented: the available resource collection is an internal Home Assistant API, while the phase requires avoiding private frontend APIs. The card supports an optional `entry_id` setting to select which integration entry to display:

```yaml
type: custom:fin-assist-card
entry_id: YOUR_CONFIG_ENTRY_ID
```

The card exposes refresh and schedule status actions through the integration services. It uses Home Assistant theme variables and reports action failures in the card.

## Validation status

The integration has focused offline tests for discovery handling and credential lifecycle, plus syntax and metadata checks. The repository's JavaScript test/lint commands do not exercise this Python integration. A live Home Assistant instance is not available, so actual Supervisor payload delivery, config-entry setup/removal, supported-version compatibility, HACS installation, storage-mode resource behavior, and frontend rendering remain **pending**. Do not treat Phase 4 as complete until those scenarios pass against a supported Home Assistant/Supervisor topology and the add-on/backend contract is verified end-to-end.
