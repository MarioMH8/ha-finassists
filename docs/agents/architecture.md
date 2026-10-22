# Architecture

## Public surfaces

| Surface | Location | Responsibility |
| --- | --- | --- |
| Home Assistant app | `config.yaml`, `Dockerfile` | Add-on metadata, runtime image, Ingress entry point, and persistent data mapping. |
| Bun application | `src/app/` | Server startup, configuration, HTTP routing, response security headers, and web asset delivery. |
| Ingress identity boundary | `src/platform/ingress/` | Resolve the acting Home Assistant user only for requests from the trusted Supervisor peer. |
| Web interface | `src/app/web/` | Static HTML, CSS, and JavaScript served directly by the application. |
| Native integration | `custom_components/ha_finassists/` | Reserved for the future Home Assistant integration; it is not implemented yet. |

## Runtime boundaries

`src/app/server.ts` is the runtime entry point. HTTP concerns live under `src/app/http/`; the platform-specific Supervisor identity logic is kept separate under `src/platform/ingress/`. Keep the web files next to the server implementation and serve them without a generated build directory.

The current API and MCP namespaces are reserved but not implemented. Do not describe them as available product features until their handlers and authentication are implemented.

## Build output

The application has no build step or emitted application artifact. Bun runs the TypeScript server directly and serves the web source files from `src/app/web/`.
