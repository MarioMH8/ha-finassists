import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it, spyOn } from 'bun:test';

import { checkpointDatabase, prepareBackup } from './backup-pre';

const databases: Database[] = [];
const directories: string[] = [];
const originalDatabasePath = Bun.env.DATABASE_PATH;

afterEach(() => {
	if (originalDatabasePath === undefined) {
		delete Bun.env.DATABASE_PATH;
	} else {
		Bun.env.DATABASE_PATH = originalDatabasePath;
	}
	for (const database of databases) {
		database.close();
	}
	databases.length = 0;
	for (const directory of directories) {
		rmSync(directory, { force: true, recursive: true });
	}
	directories.length = 0;
});

function createDirectory(): string {
	const directory = mkdtempSync(path.join(tmpdir(), 'fin-assist-backup-'));
	directories.push(directory);

	return directory;
}

describe('checkpointDatabase', () => {
	it('completes a SQLite checkpoint before backup', () => {
		const database = new Database(path.join(createDirectory(), 'fin-assist.sqlite'));
		databases.push(database);
		database.run('PRAGMA journal_mode = WAL');
		database.run('CREATE TABLE records (value TEXT NOT NULL)');
		database.query('INSERT INTO records (value) VALUES (?)').run('latest');

		expect(() => checkpointDatabase(database)).not.toThrow();
		expect(database.query('SELECT value FROM records').get()).toEqual({ value: 'latest' });
	});
});

describe('checkpointDatabase when the checkpoint is busy', () => {
	it('should throw when the WAL checkpoint cannot complete', () => {
		const database = new Database(':memory:');
		databases.push(database);
		const busyCheckpoint = database.query('SELECT 1 AS busy, 0 AS checkpointed, 0 AS log');
		spyOn(database, 'query').mockReturnValue(busyCheckpoint);

		expect(() => checkpointDatabase(database)).toThrow('SQLite WAL checkpoint could not complete before backup');
	});
});

describe('prepareBackup', () => {
	it('should skip the checkpoint when the database file does not exist', async () => {
		const databasePath = path.join(createDirectory(), 'missing.sqlite');
		Bun.env.DATABASE_PATH = databasePath;

		await prepareBackup();

		expect(await Bun.file(databasePath).exists()).toBe(false);
	});

	it('should checkpoint the configured database file', async () => {
		const databasePath = path.join(createDirectory(), 'fin-assist.sqlite');
		const database = new Database(databasePath);
		database.run('PRAGMA journal_mode = WAL');
		database.run('CREATE TABLE records (value TEXT NOT NULL)');
		database.query('INSERT INTO records (value) VALUES (?)').run('latest');
		database.close();
		Bun.env.DATABASE_PATH = databasePath;

		await prepareBackup();

		const reopened = new Database(databasePath, { readonly: true });
		databases.push(reopened);
		expect(reopened.query('SELECT value FROM records').get()).toEqual({ value: 'latest' });
	});
});
