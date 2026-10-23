import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it } from 'bun:test';

import { checkpointDatabase } from './backup-pre';

const databases: Database[] = [];
const directories: string[] = [];

afterEach(() => {
	for (const database of databases) {
		database.close();
	}
	databases.length = 0;
	for (const directory of directories) {
		rmSync(directory, { force: true, recursive: true });
	}
	directories.length = 0;
});

describe('checkpointDatabase', () => {
	it('completes a SQLite checkpoint before backup', () => {
		const directory = mkdtempSync(path.join(tmpdir(), 'fin-assist-backup-'));
		directories.push(directory);
		const database = new Database(path.join(directory, 'fin-assist.sqlite'));
		databases.push(database);
		database.run('PRAGMA journal_mode = WAL');
		database.run('CREATE TABLE records (value TEXT NOT NULL)');
		database.query('INSERT INTO records (value) VALUES (?)').run('latest');

		expect(() => checkpointDatabase(database)).not.toThrow();
		expect(database.query('SELECT value FROM records').get()).toEqual({ value: 'latest' });
	});
});
