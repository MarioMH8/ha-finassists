import type { Database } from 'bun:sqlite';

interface Migration {
	version: number;
	up(database: Database): void;
}

// Dropped children first so foreign keys never block a drop.
const LEGACY_FINANCIAL_TABLES = [
	'shared_expense_allocations',
	'shared_expense_settlements',
	'shared_expense_participants',
	'shared_expenses',
	'scheduled_payment_occurrences',
	'scheduled_payments',
	'budgets',
	'transaction_parts',
	'transactions',
	'transfers',
	'statement_imports',
	'accounts',
	'categories',
	'classes',
	'books',
];

const MIGRATIONS: Migration[] = [
	{
		up(database) {
			database.run(`
				CREATE TABLE IF NOT EXISTS api_tokens (
					id TEXT PRIMARY KEY,
					owner_id TEXT NOT NULL,
					name TEXT NOT NULL,
					token_prefix TEXT NOT NULL,
					secret_hash TEXT NOT NULL UNIQUE,
					created_at TEXT NOT NULL
				)
			`);
			database.run('CREATE INDEX IF NOT EXISTS api_tokens_owner_index ON api_tokens(owner_id)');
		},
		version: 1,
	},
	{
		// Legacy financial schema (books, accounts, categories, ...). Removed in version 5.
		up() {
			// Intentionally empty: replaced by version 5.
		},
		version: 2,
	},
	{
		up() {
			// Intentionally empty: replaced by version 5.
		},
		version: 3,
	},
	{
		up(database) {
			database.run(`
				CREATE TABLE system_credentials (
					id TEXT PRIMARY KEY,
					token_prefix TEXT NOT NULL,
					secret_hash TEXT NOT NULL UNIQUE,
					created_at TEXT NOT NULL
				)
			`);
			database.run(`
				CREATE TABLE system_credential_bootstrap (
					id INTEGER PRIMARY KEY CHECK (id = 1),
					secret_hash TEXT NOT NULL,
					expires_at TEXT NOT NULL,
					redeemed_at TEXT
				)
			`);
		},
		version: 4,
	},
	{
		up(database) {
			for (const table of LEGACY_FINANCIAL_TABLES) {
				database.run(`DROP TABLE IF EXISTS ${table}`);
			}
			database.run(`
				CREATE TABLE transactions (
					id TEXT PRIMARY KEY,
					kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
					amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
					currency_code TEXT NOT NULL CHECK (length(currency_code) = 3),
					description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 200),
					transaction_date TEXT NOT NULL,
					actor_id TEXT,
					created_at TEXT NOT NULL
				)
			`);
			database.run(
				'CREATE INDEX transactions_date_index ON transactions(transaction_date DESC, created_at DESC, id DESC)'
			);
		},
		version: 5,
	},
];

function migrateDatabase(database: Database): void {
	database.run('PRAGMA foreign_keys = ON');
	database.run(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`);

	for (const migration of MIGRATIONS) {
		const applied = database.query('SELECT 1 FROM schema_migrations WHERE version = ?').get(migration.version);
		if (applied) {
			continue;
		}

		const apply = database.transaction(() => {
			migration.up(database);
			database.query('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version);
		});
		apply();
	}
}

export { migrateDatabase };
