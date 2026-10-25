# Identity is for audit attribution, not financial authorization

## Decision

Home Assistant Ingress identifies a browser user by the stable Supervisor-provided user ID when available. Missing identity remains unknown; it never falls back to a display name or a default user. Identity headers are accepted only when the TCP peer matches the configured Supervisor IP, and `/api/v1/session` rejects requests from other peers. The add-on defaults to the standard Supervisor address and exposes a `supervisor_ip` option for non-standard networks; `SUPERVISOR_IP` overrides it for direct container runs. Invalid configured addresses prevent startup.

Identity is audit attribution, not financial authorization. Each user may issue full-access personal REST/MCP tokens from the Ingress interface; a token is shown only once, has no default expiration, and can only be listed or revoked by its owner. Token secrets are stored as hashes in persistent SQLite, using Bun's built-in driver. The token owner is the audited actor for external calls; the Home Assistant integration uses a separate system identity. All users who can access Ingress share full financial permissions. This separates household access from identity attribution and avoids misattributing automated calls to a person.

## Consequences

The service must use the socket peer address, never a client-supplied forwarding header, to validate the Supervisor boundary. Every future authenticated REST/MCP route must enforce its own authentication and authorization; a trusted Ingress identity alone does not authorize financial operations. Direct development runs must configure `SUPERVISOR_IP` to match their connecting peer.
