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
