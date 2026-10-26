# Loading states are delayed skeletons

The web interface is server rendered and runs inside Home Assistant Ingress, so its first paint already contains whatever the page shows while data is on the way. A text notice ("Loading transactions…") is unlike the rest of the interface and easy to see flash: most requests finish in a few milliseconds, so the notice is replaced before it can be read, and every section switch flashes it again.

Content-shaped skeletons follow the Home Assistant loading pattern (https://contributors.home-assistant.io/design/patterns/loading/) and replace those notices. A skeleton keeps the final layout in place, so nothing jumps when the data arrives: summary cards reserve their three metrics, and every data table keeps its real header, toolbar and row rhythm while its rows load. The placeholders live in the shared `@app/components/skeleton` module (`Skeleton`, `SkeletonTableBody`, `LoadingStatus`), so feature code only composes shapes and sizes them with its own CSS.

## The delay

A skeleton stays invisible for 300 ms after it is mounted and only then fades in. The delay is a CSS animation delay with `animation-fill-mode: backwards` (`--skeleton-delay`), not a timer: no state changes, no extra render, no hydration-sensitive code, and the placeholder's space is reserved from the same paint that starts the count. A load that finishes inside the window unmounts the skeleton before it is ever visible, so the interface does not flash.

## Accessibility

The placeholder is `aria-hidden`. The wait is announced through a visually hidden `role="status"` label that reuses the existing translated copy, so assistive technology hears a quiet status instead of the assertive `role="alert"` interruption the notice produced. Skeletons stop pulsing under `prefers-reduced-motion: reduce` while keeping the delay, and `forced-colors: active` gets a `GrayText` fill.

## Boundaries

Only a first load with no data yet uses a skeleton. Pagination, filter and section refreshes keep the current rows and mark the container busy with `aria-busy`, because replacing visible data with placeholders loses context and makes the page jump. Errors keep using `Notice` and empty results keep using `EmptyState`; a skeleton never outlives the request.

Bun renames `@keyframes` inside CSS modules without rewriting the animation references, so the two shared keyframes are declared in `src/app/styles/global.css` and used unscoped by the module.
