# Each financial book is an isolated household ledger

One installation creates one financial book by default but may contain several. Every book owns its own accounts, transactions, classifications, budgets, schedules, imports, shared expenses, and single currency; the UI selects books per user/browser, while API and MCP requests identify a book explicitly when context is absent. Books with records are archived rather than deleted, and only empty books may be deleted. This keeps household use convenient without making multiple books share or accidentally mix financial data.
