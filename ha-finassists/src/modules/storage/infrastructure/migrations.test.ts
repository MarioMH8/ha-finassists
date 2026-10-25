import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';

import { migrateDatabase } from './migrations';

describe('migrateDatabase', () => {
	it('creates the token schema and is idempotent', () => {
		const database = new Database(':memory:');
		migrateDatabase(database);
		migrateDatabase(database);

		expect(database.query('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual([
			{ version: 1 },
			{ version: 2 },
			{ version: 3 },
			{ version: 4 },
			{ version: 5 },
			{ version: 6 },
		]);
		expect(
			database.query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'api_tokens'`).get()
		).toEqual({ name: 'api_tokens' });
		database.close();
	});

	it('preserves existing token rows during migration', () => {
		const database = new Database(':memory:');
		database.run(`CREATE TABLE api_tokens (
			id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
			token_prefix TEXT NOT NULL, secret_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
		)`);
		database
			.query('INSERT INTO api_tokens VALUES (?, ?, ?, ?, ?, ?)')
			.run('id', 'owner', 'name', 'fa_', 'hash', 'now');

		migrateDatabase(database);

		expect(database.query('SELECT id, owner_id, secret_hash FROM api_tokens').get()).toEqual({
			id: 'id',
			owner_id: 'owner',
			secret_hash: 'hash',
		});
		database.close();
	});

	it('creates the minimal transactions schema', () => {
		const database = new Database(':memory:');
		migrateDatabase(database);

		expect(
			database
				.query<{ name: string }, []>(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
				.all()
				.map(row => row.name)
		).toEqual([
			'api_tokens',
			'categories',
			'schema_migrations',
			'system_credential_bootstrap',
			'system_credentials',
			'transactions',
		]);
		database.close();
	});

	it('adds an optional category to transactions and enforces the reference', () => {
		const database = new Database(':memory:');
		migrateDatabase(database);

		const columns = database
			.query<{ name: string }, []>('PRAGMA table_info(transactions)')
			.all()
			.map(row => row.name);
		database.run(
			`INSERT INTO transactions (id, kind, amount_minor, currency_code, description, transaction_date, actor_id, created_at)
			 VALUES ('a', 'expense', 100, 'EUR', '', '2026-05-15', NULL, '2026-05-15T10:00:00.000Z')`
		);

		expect(columns).toContain('category_id');
		expect(database.query('SELECT category_id FROM transactions WHERE id = ?').get('a')).toEqual({
			category_id: null,
		});
		expect(() =>
			database.run(
				`INSERT INTO transactions (id, kind, amount_minor, currency_code, description, transaction_date, category_id, actor_id, created_at)
				 VALUES ('b', 'expense', 100, 'EUR', '', '2026-05-15', 'missing', NULL, '2026-05-15T10:00:00.000Z')`
			)
		).toThrow('FOREIGN KEY');
		database.close();
	});

	it('discards legacy financial tables and keeps credentials', () => {
		const database = new Database(':memory:');
		database.run('PRAGMA foreign_keys = ON');
		database.run('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT)');
		for (const version of [1, 2, 3, 4]) {
			database.query('INSERT INTO schema_migrations VALUES (?, ?)').run(version, 'now');
		}
		database.run(`CREATE TABLE api_tokens (
			id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
			token_prefix TEXT NOT NULL, secret_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
		)`);
		database.run('CREATE TABLE books (id TEXT PRIMARY KEY)');
		database.run('CREATE TABLE transactions (id TEXT PRIMARY KEY, book_id TEXT REFERENCES books(id))');
		database.run('INSERT INTO api_tokens VALUES (?, ?, ?, ?, ?, ?)', ['id', 'owner', 'name', 'fa_', 'hash', 'now']);
		database.run('INSERT INTO books VALUES (?)', ['book']);
		database.run('INSERT INTO transactions VALUES (?, ?)', ['t', 'book']);

		migrateDatabase(database);

		expect(database.query('SELECT COUNT(*) AS count FROM api_tokens').get()).toEqual({ count: 1 });
		expect(database.query('SELECT COUNT(*) AS count FROM transactions').get()).toEqual({ count: 0 });
		expect(database.query(`SELECT name FROM sqlite_master WHERE name = 'books'`).get()).toBeNull();
		database.close();
	});

	it('rolls back a failed migration and leaves the previous schema usable', () => {
		const database = new Database(':memory:');
		database.run('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
		database.run(`CREATE TRIGGER fail_migration_record BEFORE INSERT ON schema_migrations
			BEGIN SELECT RAISE(ABORT, 'migration insert failed'); END`);

		expect(() => migrateDatabase(database)).toThrow('migration insert failed');
		expect(
			database.query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'api_tokens'`).get()
		).toBeNull();
		expect(database.query('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({ count: 0 });
		database.close();
	});
});
