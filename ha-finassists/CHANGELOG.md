# ha-finassists

## 0.3.0

### Minor Changes

- 6d4bb5f: Expose scheduled transactions through the REST API and MCP, including automatic or manual posting, skips and a 30-day forecast with totals and category breakdown.
- 2c9d530: Post scheduled expenses and incomes automatically when they are due, or keep them pending for manual confirmation, with bounded catch-up after downtime and pause/resume support.
- 370a154: Expose scheduled movements in Home Assistant with forecast and due sensors, scheduled add/delete/post/skip services, and recorded-versus-scheduled totals in the Lovelace card.
- 8625223: Manage scheduled expenses and incomes in the web app, with a next-30-days forecast, pending manual confirmations, pause/resume and a one-time or recurring form.
- 5ebe03c: Add scheduled expenses and incomes with one-time and recurring dates, automatic or manual posting, a 30-day forecast, REST and MCP access, and Home Assistant sensors, services and card support.

### Patch Changes

- 93b0131: Replace the loading messages with delayed skeletons, so the web app keeps its layout and never flashes a placeholder while data loads.

## 0.2.5

### Patch Changes

- 52840ec: Keep the transaction toolbar inline and outside the horizontal table scroller, keep table cell text on one line, and stop the page-content focus outline from appearing after a dialog closes.

## 0.2.4

### Patch Changes

- 192b932: Remove the duplicated top safe-area inset from full-screen dialogs inside the Home Assistant app, so iOS forms start right below the app header.

## 0.2.3

### Patch Changes

- 200d997: Keep alert dialog footer buttons at their normal height instead of stretching them to the dialog height.

## 0.2.2

### Patch Changes

- 7167686: Hide the categories kind filter when there are no categories, and explain a filtered empty state when the selected kind has no categories.
- c014712: Align the active tokens section with the categories and transactions sections: the heading, status and create action now sit outside the card, and the card holds only the token list or empty state.

## 0.2.1

### Patch Changes

- ca821fa: Keep focus inside the Ingress frame after closing a dialog, so Home Assistant no longer draws a grey frame around the app.
- 0de268f: Unify empty states with the Home Assistant empty state pattern and the same card surface.
- 5bb0e5d: Match form controls and dialog layout to Home Assistant on macOS and iOS.

## 0.2.0

### Minor Changes

- 6988ed0: Manage categories in the app: create, rename and delete them, assign one to each movement, and filter the list by category.
- f2258a6: Add categories to the ledger: a flat, kind-aware grouping that transactions can optionally reference.
- e5927a1: Expose categories through the REST API and the MCP server, and let transactions reference and filter by them.
- b5823d0: Let the Home Assistant services record a category by name, expose the monthly breakdown per category on the sensors and render it in the bundled card.
