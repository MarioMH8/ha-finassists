---
'ha-finassists': minor
---

Add the `scheduled_transactions` capability. When disabled, the app hides the Scheduled section, pauses active schedules, stops automatic posting, removes scheduled REST routes and MCP tools, and the integration stops creating scheduled sensors while its scheduled services fail with a clear error. Re-enabling leaves schedules paused so they do not post a backlog.
