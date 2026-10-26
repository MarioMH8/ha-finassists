# Focus stays inside the Ingress frame after a dialog closes

## Status

Accepted.

## Context

Fin Assist runs inside a Home Assistant Ingress iframe. In the Home Assistant macOS and iOS apps, closing any dialog left a 2px grey outline around the whole page. The outline did not belong to the dialog: Home Assistant styles `:focus-visible` on the Ingress `<iframe>` in its own document, and WebKit can return focus to that frame instead of to the element inside Fin Assist that opened the dialog. While the frame holds focus, the parent page paints the outline around the app.

A native `<dialog>` normally restores focus by itself, but Ingress adds a second document boundary. Restoring focus inside Fin Assist is what keeps the parent frame from holding it.

## Decision

The `Dialog` component records the focused element that opened it. After `dialog.close()`, it restores focus inside the frame with `requestAnimationFrame`: `window.focus()` first, then the opener when it is still connected. If the opener is gone, focus moves to `#main-content`, which already has `tabIndex={-1}`. Escape, the backdrop and the close button keep calling `onClose` once, and the native `close` event is ignored when the app initiated the close so the parent is not notified twice.

As a second line of defence, `src/app/shell/ingress-frame.ts` clears the parent iframe's inline `outline` and `outline-offset`. It reads the parent document inside `try`/`catch`, matches the frame whose `contentWindow` is the current window, and does nothing when there is no parent, the app is the top-level document, or the parent is cross-origin. The client entry point calls the helper after hydration, and the dialog calls it after restoring focus, so an iframe that Home Assistant replaced or re-rendered is cleared as well.

## Consequences

- Focus returns to the control that opened the dialog, so keyboard users continue from where they were.
- Home Assistant keeps its own focus styling; Fin Assist only removes the inline outline from the iframe that hosts it.
- The parent outline removal is Ingress-specific and degrades to a no-op outside Home Assistant or across origins.
- Unit tests cover frame selection and outline removal. Confirming that the grey frame is gone still needs the Home Assistant macOS or iOS app, because the WebView focus behaviour and the parent document live outside the automated suite.
