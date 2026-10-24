import type { BookCriteria, BookRepository } from '@modules/books/domain';
import { Book } from '@modules/books/domain';
import type { Database, SQLQueryBindings } from 'bun:sqlite';

interface BookRow {
	archived_at: null | string;
	created_at: string;
	currency_code: string;
	id: string;
	is_default: number;
	name: string;
}

function toBook(row: BookRow): Book {
	return Book.restore({
		archivedAt: row.archived_at,
		createdAt: row.created_at,
		currencyCode: row.currency_code,
		id: row.id,
		isDefault: row.is_default === 1,
		name: row.name,
	});
}

function where(criteria: BookCriteria): { parameters: (number | string)[]; sql: string } {
	const clauses: string[] = [];
	const parameters: (number | string)[] = [];

	if (criteria.id !== undefined) {
		clauses.push('id = ?');
		parameters.push(criteria.id);
	}
	if (criteria.name !== undefined) {
		clauses.push('name = ?');
		parameters.push(criteria.name);
	}
	if (criteria.currencyCode !== undefined) {
		clauses.push('currency_code = ?');
		parameters.push(criteria.currencyCode);
	}
	if (criteria.isDefault !== undefined) {
		clauses.push('is_default = ?');
		parameters.push(criteria.isDefault ? 1 : 0);
	}
	if (criteria.archivedAt === null) {
		clauses.push('archived_at IS NULL');
	} else if (criteria.archivedAt !== undefined) {
		clauses.push('archived_at = ?');
		parameters.push(criteria.archivedAt);
	}

	return { parameters, sql: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '' };
}

class SqliteBookRepository implements BookRepository {
	constructor(private readonly database: Database) {}

	delete({ id }: { id: string }): boolean {
		const deleteBook = this.database.transaction(
			() =>
				this.database
					.query(
						`DELETE FROM books WHERE id = ?
					AND NOT EXISTS (SELECT 1 FROM accounts WHERE accounts.book_id = books.id)
					AND NOT EXISTS (SELECT 1 FROM categories WHERE categories.book_id = books.id)
					AND NOT EXISTS (SELECT 1 FROM classes WHERE classes.book_id = books.id)
					AND NOT EXISTS (SELECT 1 FROM transactions WHERE transactions.book_id = books.id)
					AND NOT EXISTS (SELECT 1 FROM transfers WHERE transfers.book_id = books.id)
					AND NOT EXISTS (SELECT 1 FROM statement_imports WHERE statement_imports.book_id = books.id)`
					)
					.run(id).changes > 0
		);

		return deleteBook();
	}

	find(criteria: BookCriteria): Book | undefined {
		return this.search(criteria)[0];
	}

	save(book: Book): void {
		this.database
			.query(
				`INSERT INTO books (id, name, currency_code, is_default, archived_at, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
				ON CONFLICT(id) DO UPDATE SET name = excluded.name, currency_code = excluded.currency_code,
				is_default = excluded.is_default, archived_at = excluded.archived_at, created_at = excluded.created_at`
			)
			.run(book.id, book.name, book.currencyCode, book.isDefault ? 1 : 0, book.archivedAt, book.createdAt);
	}

	search(criteria: BookCriteria = {}): Book[] {
		const filter = where(criteria);
		const rows = this.database
			.query<BookRow, SQLQueryBindings[]>(
				`SELECT * FROM books${filter.sql} ORDER BY archived_at IS NOT NULL, is_default DESC, name COLLATE NOCASE, id`
			)
			.all(...filter.parameters);

		return rows.map(row => toBook(row));
	}
}

export { SqliteBookRepository };
