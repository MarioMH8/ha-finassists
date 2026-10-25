# MCP uses stateless, authenticated Streamable HTTP

The MCP server exposes a stateless Streamable HTTP endpoint at `/mcp` so local-network MCP clients can connect to the Home Assistant app without maintaining MCP sessions. Each request authenticates with the same personal bearer tokens as REST, and the tool set makes read and write operations explicit; Home Assistant Ingress identity is for audit attribution and does not replace API/MCP authentication. The endpoint is intended for the local network and is not exposed to the Internet by default, avoiding a separate MCP credential or session model.

## Transport contract

- Support protocol version `2025-11-25`; do not create server-side sessions or return an `Mcp-Session-Id`.
- Accept authenticated JSON-RPC POST requests only. The client must negotiate both `application/json` and `text/event-stream`; successful messages currently use JSON responses, and notifications return HTTP 202 with no body. GET/SSE streaming is intentionally unsupported until the product needs server-initiated events.
- Validate a supplied `Origin` against the request URL's origin to mitigate DNS-rebinding access. Requests without `Origin` remain valid for non-browser MCP clients.
- Enforce a 6 MiB JSON request limit for Base64 imports; individual decoded import files remain limited to 2 MiB. Parse/tool errors are sanitized and no request state is retained.
- Reuse REST use cases and DTO semantics. MCP write actors are always attributed to the bearer token owner; Ingress identity never bypasses bearer authentication.

This is a deliberately narrow Bun-native adapter rather than a separate MCP business layer or SDK dependency. Protocol negotiation, origin checks, notifications, request limits, auth, and tool dispatch are covered by HTTP tests. Real-client interoperability remains an environment verification item.
