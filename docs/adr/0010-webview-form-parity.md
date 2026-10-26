# Form controls and dialogs match Home Assistant inside the app WebViews

## Status

Accepted.

## Context

Fin Assist renders in the Home Assistant Ingress iframe, both in a desktop browser and in the Home Assistant macOS and iOS apps, which embed the page in WKWebView. The same CSS produced different results in those WebViews:

- Native date and select controls kept their platform chrome instead of the outlined Home Assistant field.
- WebKit drew its own focus ring on top of the design-system border.
- iOS zoomed the page when a field smaller than 16px received focus.
- Standard dialogs ignored Home Assistant's small-screen breakpoints and safe areas, so the header and footer could sit under the notch or the home indicator.
- The iframe fell back to the system font because Roboto was never loaded.

[ADR 0008](0008-design-system-ui.md) makes the Home Assistant design documentation the source of truth and allows a deliberate deviation only when it is recorded. The relevant pages are the [dialog](https://contributors.home-assistant.io/design/components/dialog/), [text input](https://contributors.home-assistant.io/design/components/input/) and [foundations](https://contributors.home-assistant.io/design/foundations/) references.

## Decision

Keep the components, and make the CSS normalize what WebKit renders differently.

### Closed controls

- Inputs and selects reset `appearance`/`-webkit-appearance` and `box-shadow`, and draw the Home Assistant outlined field themselves: 1px neutral border, 8px radius, surface background, and the documented hover, invalid and disabled states.
- Selects keep the local chevron icon and stay `appearance: none`; inputs keep the browser's native keyboard and form semantics.

### Native pickers

Date, time and select pickers stay platform-native. The closed control is normalized, but tapping it opens the system picker on iOS and macOS instead of a custom calendar or listbox. The date value is aligned to the start and the native picker indicator stays visible and tappable.

This is a deliberate deviation from the Web Awesome based `ha-input` and `ha-select` in the Home Assistant frontend: this app has no runtime UI dependency, renders on the server, and cannot load custom elements before hydration. Reimplementing a picker would duplicate platform behavior and lose the accessibility and input handling the browser already provides.

### Focus and touch

- For these controls the primary-color border is the focus indicator; the extra WebKit ring is removed with `outline: none`. The global `:focus-visible` outline remains for every other interactive element.
- On `pointer: coarse` both input sizes and every select size use 16px text, which stops iOS from zooming the page on focus. User scaling is not restricted: no `maximum-scale` and no `user-scalable=no`.
- `-webkit-text-size-adjust: 100%` and `text-size-adjust: 100%` keep the app from inflating text on rotation.

### Dialogs and safe areas

- The viewport uses `viewport-fit=cover`, and `env(safe-area-inset-*)` is exposed as `--safe-area-inset-*` tokens with a `0px` fallback.
- A standard dialog fills the screen at `max-width: 450px` or `max-height: 500px`, matching Home Assistant, without rounded corners and with safe-area padding on all sides. It uses `height: 100dvh` with a `100vh` fallback, and the body scrolls so the footer stays reachable.
- Alert dialogs stay a rounded 320px dialog at every size.
- The dialog body uses Home Assistant's `0 24px 24px` padding and scroll containment, and the scrim is 25% black.

### Typography

- `@font-face` declares Roboto 400 and 500, preferring an installed copy and otherwise loading the Home Assistant files at `/static/fonts/roboto/*.woff2` with `font-display: swap`.
- The CSS bundle keeps `/static/*` external, so the bundler preserves the Home Assistant URL instead of resolving it as an application asset.
- No font binaries or new dependencies are added to the repository.

## Consequences

- The browser and the app WebViews render the same card, field and dialog geometry, subject to the platform's native overlays.
- Date, time and select pickers differ by platform on purpose. That is the recorded deviation: review should not replace them with custom pickers without a new ADR.
- Touch devices show 16px values in inputs and selects, slightly larger than the 14px compact size on desktop. The trade-off buys predictable focus without blocking zoom.
- Roboto depends on Home Assistant continuing to serve the static font path. If it moves, `font-display: swap` falls back to Noto or the system sans-serif; local development without Home Assistant logs a 404 for each face, which is accepted. The `/static/*` external pattern in the web build is what keeps those URLs unchanged.
- The layout relies on dynamic viewport units and `env()` with fallbacks; browsers without them keep the `100vh` and `0px` values.
- These changes are CSS, document metadata and build configuration only. There is no platform detection or WKWebView-specific branch to maintain.
- Automated tests do not emulate WKWebView safe areas or the iOS focus zoom, so the macOS and iOS apps still need a manual pass when a release changes forms or dialogs.
