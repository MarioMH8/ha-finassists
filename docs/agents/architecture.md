# Architecture

## Public surfaces

| Surface | Location | Responsibility |
| --- | --- | --- |
| Home Assistant app | `config.yaml`, `Dockerfile` | Add-on metadata, runtime image, Ingress entry point, and persistent data mapping. |
| Bun application | `src/app/` | Server startup, configuration, HTTP routing, response security headers, and web asset delivery. |
| Ingress identity boundary | `src/platform/ingress/` | Resolve the acting Home Assistant user only for requests from the trusted Supervisor peer. |
| Web interface | `src/app/web/` | React 19 UI server-rendered by the application, hydrated from an in-memory Bun client bundle, and styled with the Home Assistant-inspired CSS. |
| Native integration | `custom_components/ha_finassists/` | Reserved for the future Home Assistant integration; it is not implemented yet. |

## Runtime boundaries

`src/app/server.ts` is the runtime entry point. HTTP concerns live under `src/app/http/`; the platform-specific Supervisor identity logic is kept separate under `src/platform/ingress/`. The React UI is rendered for each request using its accepted language preference and hydrated from a browser bundle compiled once in memory when the server starts. Keep the UI source next to the server implementation; do not add a checked-in or on-disk build directory.

The current API and MCP namespaces are reserved but not implemented. Do not describe them as available product features until their handlers and authentication are implemented.

## Build output

Bun runs the TypeScript server directly without a separate build command. At startup, Bun compiles the React client entry point into an in-memory ESM bundle; the server keeps the bundle for subsequent requests. The HTML shell is streamed from React's server renderer, while the browser loads the same-origin bundle and hydrates the server markup. No generated files are written to disk.
