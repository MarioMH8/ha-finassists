# Feature flags are add-on options with two scopes

## Status

Accepted.

## Context

The web interface renders every section and panel for every installation. A household that does not use the Administration section, the monthly summary, the chart or the scheduled panels still sees them, and there is no supported way to simplify the interface without changing code.

Configuration already flows from the Home Assistant app options through `ServerConfigLoader` into `ShellConfig`, then through the request context and SSR into `data-*` attributes used by hydration. Reusing that path keeps the configuration validated, installation-wide and admin-only without adding a settings store, a new API or per-user permissions.

## Decision

Feature flags are Home Assistant app options, read at startup. Every flag defaults to `true`, so an update never changes an existing installation until the user opts in. Flags hide or disable a surface; they never delete data, and turning a flag back on restores the surface and its data.

Flags have two scopes:

- **UI flags** (`ui.*`) only change presentation. They hide a section or panel and let the corresponding hook skip its request. They do not change the REST API, MCP tools, background jobs or the Home Assistant integration.
- **Capability flags** (`capabilities.*`) disable a product capability across every surface that exposes it: web UI, REST, MCP, background jobs and the Home Assistant integration. They are added one capability at a time with their own migration and compatibility rules.

The registry lives in `src/modules/shell/domain/feature-flags.ts` and is exposed as `ShellConfig.features`. The UI reads it through `FeatureFlagsProvider`/`useFeatureFlags`, filters the navigation with `visibleSections`, and receives the same values from `data-feature-*` attributes during hydration. `readShellSettings` and `featureAttributes` are the single serialization boundary, so the server and client defaults cannot drift.

Flags are not authorization. Hiding Administration does not revoke tokens or protect the API; the REST and MCP surfaces keep their own authentication. Anything that must restrict access needs a separate permission model.

## Consequences

- Adding a UI flag means adding an option, a default, an attribute, a component guard and tests. It does not require a database migration or an API change.
- Adding a capability flag requires a decision for every surface, including existing data and re-enable behaviour. Scheduled transactions pause active schedules when disabled and leave them paused when re-enabled, so a long pause cannot create a backlog of transactions.
- Users apply changes by saving the app options and restarting the app. Live feature flags and in-app settings are deliberately out of scope.
- The app and the integration remain versioned separately. Capability consumers must default to “enabled” when a capabilities endpoint is missing, and release notes must tell users to update both.
