import type { Database } from 'bun:sqlite';

interface Migration {
	version: number;
	up(database: Database): void;
}

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
		up(database) {
			database.run(`
				CREATE TABLE books (
					id TEXT PRIMARY KEY,
					name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
					currency_code TEXT NOT NULL CHECK (length(currency_code) = 3),
					is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
					archived_at TEXT,
					created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
					UNIQUE (id, currency_code)
				)
			`);
			database.run('CREATE UNIQUE INDEX books_single_default_index ON books(is_default) WHERE is_default = 1');
			database.run(`
				CREATE TABLE accounts (
					id TEXT PRIMARY KEY,
					book_id TEXT NOT NULL,
					name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
					kind TEXT NOT NULL CHECK (kind IN ('checking', 'savings', 'credit', 'asset', 'liability')),
					opening_balance_minor INTEGER NOT NULL,
					closed_at TEXT,
					created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
					UNIQUE (book_id, id),
					FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT
				)
			`);
			database.run('CREATE INDEX accounts_book_index ON accounts(book_id, name, id)');
			database.run(`
				CREATE TABLE categories (
					id TEXT PRIMARY KEY,
					book_id TEXT NOT NULL,
					parent_id TEXT,
					name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
					archived_at TEXT,
					UNIQUE (book_id, id),
					FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT,
					FOREIGN KEY (book_id, parent_id) REFERENCES categories(book_id, id) ON DELETE RESTRICT
				)
			`);
			database.run('CREATE INDEX categories_book_index ON categories(book_id, name, id)');
			database.run(`
				CREATE TABLE classes (
					id TEXT PRIMARY KEY,
					book_id TEXT NOT NULL,
					parent_id TEXT,
					name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
					archived_at TEXT,
					UNIQUE (book_id, id),
					FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT,
					FOREIGN KEY (book_id, parent_id) REFERENCES classes(book_id, id) ON DELETE RESTRICT
				)
			`);
			database.run('CREATE INDEX classes_book_index ON classes(book_id, name, id)');
			database.run(`
				CREATE TABLE transfers (
					id TEXT PRIMARY KEY,
					book_id TEXT NOT NULL,
					from_account_id TEXT NOT NULL,
					to_account_id TEXT NOT NULL,
					amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
					transaction_date TEXT NOT NULL,
					created_by TEXT,
					created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
					CHECK (from_account_id <> to_account_id),
					UNIQUE (book_id, id),
					FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT,
					FOREIGN KEY (book_id, from_account_id) REFERENCES accounts(book_id, id) ON DELETE RESTRICT,
					FOREIGN KEY (book_id, to_account_id) REFERENCES accounts(book_id, id) ON DELETE RESTRICT
				)
			`);
			database.run(`
				CREATE TABLE transactions (
					id TEXT PRIMARY KEY,
					book_id TEXT NOT NULL,
					account_id TEXT NOT NULL,
					transfer_id TEXT,
					transaction_date TEXT NOT NULL,
					payee TEXT NOT NULL DEFAULT '',
					memo TEXT NOT NULL DEFAULT '',
					amount_minor INTEGER NOT NULL,
					status TEXT NOT NULL DEFAULT 'uncleared' CHECK (status IN ('uncleared', 'cleared', 'reconciled')),
					actor_id TEXT,
					created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
					UNIQUE (book_id, id),
					FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT,
					FOREIGN KEY (book_id, account_id) REFERENCES accounts(book_id, id) ON DELETE RESTRICT,
					FOREIGN KEY (book_id, transfer_id) REFERENCES transfers(book_id, id) ON DELETE RESTRICT
				)
			`);
			database.run(
				'CREATE INDEX transactions_account_date_index ON transactions(book_id, account_id, transaction_date, id)'
			);
			database.run(`
				CREATE TABLE transaction_parts (
					id TEXT PRIMARY KEY,
					book_id TEXT NOT NULL,
					transaction_id TEXT NOT NULL,
					category_id TEXT,
					class_id TEXT,
					amount_minor INTEGER NOT NULL,
					memo TEXT NOT NULL DEFAULT '',
					FOREIGN KEY (book_id, transaction_id) REFERENCES transactions(book_id, id) ON DELETE CASCADE,
					FOREIGN KEY (book_id, category_id) REFERENCES categories(book_id, id) ON DELETE RESTRICT,
					FOREIGN KEY (book_id, class_id) REFERENCES classes(book_id, id) ON DELETE RESTRICT
				)
			`);
			database.run(
				'CREATE INDEX transaction_parts_transaction_index ON transaction_parts(book_id, transaction_id)'
			);
			database.run(`
				CREATE TABLE statement_imports (
					id TEXT PRIMARY KEY,
					book_id TEXT NOT NULL,
					account_id TEXT NOT NULL,
					format TEXT NOT NULL CHECK (format IN ('qif', 'payee_csv', 'statement_csv')),
					content_hash TEXT NOT NULL,
					imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
					UNIQUE (book_id, account_id, content_hash),
					FOREIGN KEY (book_id, account_id) REFERENCES accounts(book_id, id) ON DELETE RESTRICT
				)
			`);
		},
		version: 2,
	},
	{
		up(database) {
			database.run(
				'ALTER TABLE transaction_parts ADD COLUMN position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0)'
			);
			database.run(
				'CREATE INDEX transaction_parts_order_index ON transaction_parts(book_id, transaction_id, position, id)'
			);
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
