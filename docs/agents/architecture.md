# Architecture

## Public surfaces

| Surface | Location | Responsibility |
| --- | --- | --- |
| Home Assistant app | `config.yaml`, `Dockerfile` | Add-on metadata, runtime image, Ingress entry point, and persistent data mapping. |
| Bun application | `src/server.ts`, `src/application.ts`, `src/config.ts` | Runtime entry point, dependency composition, and validated environment/add-on configuration. |
| HTTP API | `src/modules/api/infrastructure/http/` | Inbound HTTP adapter, routes, security headers, and web asset delivery; application behavior is delegated to the owning modules. |
| Home Assistant identity | `src/modules/home-assistant/` | Domain actor types plus the Ingress infrastructure adapter that resolves actors only from a trusted Supervisor peer. |
| Web interface | `src/app/` | Modular React 19 UI with JSON translations and CSS Modules, rendered by a Bun SSR bundle and hydrated from a separately built client bundle. |
| Native integration | `custom_components/ha_finassists/` | Reserved for the future Home Assistant integration; it is not implemented yet. |

## Runtime boundaries

`src/server.ts` is the runtime entry point and delegates dependency composition to `src/application.ts`. The API module currently provides an inbound HTTP infrastructure adapter under `src/modules/api/infrastructure/http/`; token behavior remains owned by `src/modules/tokens/`. Home Assistant actor types live in the domain layer, while Supervisor header and peer validation live under `src/modules/home-assistant/infrastructure/ingress/`. The React UI lives under `src/app/`, with the client hydration entrypoint at the app root, document composition in `shell/`, reusable UI in `components/`, feature flows in `features/`, locale data in `i18n/`, and shared CSS in `styles/`. `LocaleProvider` receives the request language through the app tree in both SSR and hydration; do not store request-specific locale state in a server-global singleton. Use `@modules/*` and `@app/*` TypeScript aliases across modules; keep relative imports within a layer. Production identity always comes from the trusted Supervisor peer; only development configuration may supply a mock actor.

The current financial API and MCP namespaces are reserved but not implemented. Do not describe them as available product features until their handlers and authentication are implemented.

## Build output

`bun run build` coordinates `build:server` and `build:web`, writing production artifacts to the ignored `dist/` directory. `build:web` separately builds the browser client and Bun SSR renderer, and publishes the SSR renderer's emitted CSS (global and CSS Module styles) as `dist/styles.css`. `bun run dev` runs the TypeScript server under Bun watch and compiles the client, CSS, and SSR renderer in memory; a development-only version endpoint lets browser clients reload after source changes. The HTML shell is streamed from the SSR renderer and hydrates from a same-origin bundle. The shared UI is split into reusable components and feature modules, translations live in JSON locale files, and component styles use CSS Modules without a runtime CSS dependency.
