import { migrateDatabase } from '@modules/storage/infrastructure';
import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';

import { ArchiveBook, CreateBook, DeleteBook, EnsureDefaultBook, ListBooks } from '../../application';
import { SqliteBookRepository } from './sqlite-book.repository';

describe('book use cases', () => {
	function setup() {
		const database = new Database(':memory:');
		migrateDatabase(database);
		const repository = new SqliteBookRepository(database);

		return { database, repository };
	}

	it('creates the default book once and lists books deterministically', () => {
		const { database, repository } = setup();
		const ensureDefaultBook = new EnsureDefaultBook(repository);
		const first = ensureDefaultBook.execute();
		const second = ensureDefaultBook.execute();
		const created = new CreateBook(repository).execute({ currencyCode: 'USD', name: 'Travel' });

		expect(first).toEqual(second);
		expect(first).toMatchObject({ currencyCode: 'EUR', id: 'default', isDefault: true, name: 'Household' });
		expect(repository.find({ id: first.id })).toEqual(first);
		expect(repository.search({ isDefault: true })).toEqual([first]);
		expect(new ListBooks(repository).execute().map(book => book.id)).toEqual(['default', created.id]);
		database.close();
	});

	it('deletes only empty books and archives non-empty books', () => {
		const { database, repository } = setup();
		new EnsureDefaultBook(repository).execute();
		const book = new CreateBook(repository).execute({ currencyCode: 'USD', name: 'Travel' });
		const bookCleanup = new DeleteBook(repository);

		expect(bookCleanup.execute(book.id)).toBe(true);
		expect(bookCleanup.execute(book.id)).toBe(false);
		database
			.query('INSERT INTO accounts (id, book_id, name, kind, opening_balance_minor) VALUES (?, ?, ?, ?, ?)')
			.run('account-1', 'default', 'Cash', 'checking', 0);
		expect(bookCleanup.execute('default')).toBe(false);
		expect(repository.find({ id: 'default' })).toBeDefined();
		expect(new ArchiveBook(repository).execute('default')).toBe(true);
		expect(new ListBooks(repository).execute()[0]?.archivedAt).not.toBeNull();
		database.close();
	});

	it('rejects empty or invalid book attributes', () => {
		const { database, repository } = setup();
		const create = new CreateBook(repository);

		expect(() => create.execute({ currencyCode: 'USD', name: '  ' })).toThrow('Book name must contain');
		expect(() => create.execute({ currencyCode: 'USDX', name: 'Travel' })).toThrow('Currency');
		database.close();
	});
});
