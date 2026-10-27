# The web interface follows the Home Assistant design system

## Status

Accepted.

## Context

Fin Assist renders inside Home Assistant Ingress, but Home Assistant theme variables are not inherited across the iframe. The UI still needs to feel native to the surrounding product, stay accessible, and avoid accumulating one-off layouts and controls for each feature.

The Home Assistant design documentation is the source of truth for components, foundations, and patterns:

- https://contributors.home-assistant.io/design/components/
- https://contributors.home-assistant.io/design/foundations/
- https://contributors.home-assistant.io/design/patterns/
- https://contributors.home-assistant.io/design/dashboards/

## Decision

The web interface uses a local design-token layer and local React components that follow the Home Assistant design system. Tokens live in `src/app/styles/global.css`; reusable components live in `src/app/components/`; feature-specific composition stays in `src/app/features/`.

### Components and ownership

- Reuse an existing component before creating a new one. Add a prop or variant to the component instead of styling it from a consumer.
- Follow the Home Assistant component model: button `appearance`/`variant`/`size`, input and select sizes, card `tone`/`padding`/`bleed`, and table alignment props.
- Keep custom CSS in the component that owns the visual behavior. Consumers own layout only: grids, gaps, and placement.
- CSS Modules and design tokens are required. Do not introduce raw colors or spacing values when a token exists.

### Surfaces

- A card is a surface. A data table and a native dialog are also surfaces.
- Do not nest two bordered surfaces. A data table stays at page level; card content uses `Card bleed` or list rows when it should reach the card edges.
- When a bordered element is nested inside another bordered element:
  - keep the same inset on all four sides;
  - reduce the inner radius with `inner radius = outer radius - inset`.
- The table toolbar is the reference implementation: 8px inset and `12px - 8px = 4px` inner radius.

### Dialogs, menus, and destructive actions

- Short forms, confirmations, and filter forms use the native modal `Dialog`.
- Standard dialogs use a 48x48 close button at the top left and 4px/8px header padding. Alert dialogs have no close button and only the decision actions.
- Overflow actions use the keyboard-navigable `Menu`, not inline rows of buttons.
- Destructive actions are placed last, use the danger variant, and require a confirmation dialog.
- Secrets that are shown only once stay inside the creation dialog until the user closes it.

### Tables and lists

- Work with columns uses the `DataTable` as the main surface, not inside a card.
- The table header is transparent over the table surface with a bottom divider.
- Search and view controls live in the `DataTable` header slot. Filters open from a chip into a dialog.
- Row actions use an overflow `Menu`.
- Bulk selection uses native checkboxes, a select-all state with an indeterminate mode, and a selection bar in the table header.
- Pagination sits in the footer; page-size selection is a view option in the table toolbar.
- Lists for cards use `List`/`ListItem`; tables are for column-oriented management views.

### Forms and feedback

- Forms use `Field` for labels, hints, and errors; inputs use the small 40px size in dialogs.
- Field validation stays next to the field. Form-level success or failure uses `Notice`.
- Loading states use skeletons that stay invisible for a short delay, so a fast load never flashes a placeholder ([delayed skeleton loading](0012-delayed-skeleton-loading.md)). Errors and empty states use `Notice` and `EmptyState` instead of ad-hoc paragraphs.
- Filters and long-running tables use server-side pagination and an explicit result count.

### Charts and dashboards

- A single trend uses a sparkline without axes; comparisons over time use a statistics graph with axes, legend, exact values, and an accessible table equivalent.
- Charts use semantic tokens for series colors and remain readable in light and dark mode.
- Summary charts are collapsed by default behind an accessible toggle so the primary numbers stay dominant, especially on mobile.
- If a charting dependency is introduced later, it must consume the same semantic tokens and preserve SSR and accessibility behavior.

### Responsive behavior

- Keep primary actions visible and group secondary actions.
- On mobile, compact KPIs into one row when values fit; stack only when the content needs the full width.
- Dialogs become full-screen on small screens; the footer remains reachable.

### Accessibility

- Menus and dialogs support keyboard navigation, Escape, focus return, and explicit accessible names.
- Icon-only controls always have an `aria-label`; destructive actions include the affected item in their accessible name when useful.
- Charts provide a text or table alternative; color is never the only way to distinguish a series.
- Target sizes follow the component specs (48px dialog close, 40px small buttons/inputs, 32px compact controls).

## Consequences

- New UI work starts by checking the Home Assistant design documentation and the local component API.
- A missing visual need should become a reusable prop, variant, or component, not a consumer-specific CSS override.
- Reviewers should reject ad-hoc colors, spacing, nested bordered surfaces, and inline action groups when a documented pattern exists.
- The design system remains documentation-driven: the linked Home Assistant pages are authoritative unless this repository records a deliberate deviation in a new ADR.
