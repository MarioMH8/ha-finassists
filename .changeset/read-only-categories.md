---
'ha-finassists': minor
---

Make categories read-only when the `categories` option is off. The app hides the Categories section and category controls, category mutations are unavailable in REST and MCP, and `GET /categories` keeps existing references, reports and integration breakdowns working. No category or `categoryId` data is deleted.
