# ha-finassists

## 0.2.0

### Minor Changes

- 6988ed0: Manage categories in the app: create, rename and delete them, assign one to each movement, and filter the list by category.
- f2258a6: Add categories to the ledger: a flat, kind-aware grouping that transactions can optionally reference.
- e5927a1: Expose categories through the REST API and the MCP server, and let transactions reference and filter by them.
- b5823d0: Let the Home Assistant services record a category by name, expose the monthly breakdown per category on the sensors and render it in the bundled card.
