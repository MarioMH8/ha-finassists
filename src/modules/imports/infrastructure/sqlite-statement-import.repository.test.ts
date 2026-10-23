import { CreateBook, EnsureDefaultBook } from '@modules/books/application';
import { SqliteBookRepository } from '@modules/books/infrastructure';
import { migrateDatabase } from '@modules/storage/infrastructure';
import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';

import { SqliteStatementImportRepository } from './sqlite-statement-import.repository';

function setup() {
	const database = new Database(':memory:');
	migrateDatabase(database);
	const books = new SqliteBookRepository(database);
	new EnsureDefaultBook(books).execute();
	const book = new CreateBook(books).execute({ currencyCode: 'EUR', name: 'Travel' });
	database
		.query(
			`INSERT INTO accounts (id, book_id, name, kind, opening_balance_minor) VALUES ('cash', ?, 'Cash', 'checking', 0)`
		)
		.run(book.id);
	database
		.query(
			`INSERT INTO transactions (id, book_id, account_id, transaction_date, amount_minor, payee, status)
			VALUES ('t1', ?, 'cash', '2024-01-05', -1250, 'Café Demo', 'uncleared'), ('t2', ?, 'cash', '2024-01-05', -1250, 'Café Demo', 'uncleared')`
		)
		.run(book.id, book.id);

	return { book, database, repository: new SqliteStatementImportRepository(database) };
}

describe('SqliteStatementImportRepository', () => {
	it('records and finds an import by book, account and content hash', () => {
		const { book, repository } = setup();
		expect(repository.find(book.id, 'cash', 'abc')).toBeUndefined();
		const saved = repository.record({ accountId: 'cash', bookId: book.id, contentHash: 'abc', format: 'qif' });
		expect(saved).toMatchObject({ accountId: 'cash', bookId: book.id, contentHash: 'abc', format: 'qif' });
		expect(repository.find(book.id, 'cash', 'abc')).toEqual(saved);
		expect(repository.find(book.id, 'cash', 'other')).toBeUndefined();
	});

	it('rejects a duplicate content hash through the unique constraint', () => {
		const { book, repository } = setup();
		repository.record({ accountId: 'cash', bookId: book.id, contentHash: 'abc', format: 'qif' });
		expect(() =>
			repository.record({ accountId: 'cash', bookId: book.id, contentHash: 'abc', format: 'statement_csv' })
		).toThrow();
	});

	it('counts transactions matching date, amount and payee', () => {
		const { book, repository } = setup();
		expect(repository.countMatching(book.id, 'cash', '2024-01-05', -1250, 'Café Demo')).toBe(2);
		expect(repository.countMatching(book.id, 'cash', '2024-01-05', -1251, 'Café Demo')).toBe(0);
		expect(repository.countMatching(book.id, 'cash', '2024-01-06', -1250, 'Café Demo')).toBe(0);
	});

	it('rolls back all work when the callback throws and returns its value otherwise', () => {
		const { book, database, repository } = setup();
		expect(repository.runAtomically(() => 42)).toBe(42);
		expect(() =>
			repository.runAtomically(() => {
				repository.record({ accountId: 'cash', bookId: book.id, contentHash: 'abc', format: 'qif' });
				throw new Error('boom');
			})
		).toThrow('boom');
		expect(
			(database.query('SELECT COUNT(*) AS total FROM statement_imports').get() as { total: number }).total
		).toBe(0);
	});
});
