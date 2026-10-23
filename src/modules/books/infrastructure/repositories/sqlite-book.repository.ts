import type { Database } from 'bun:sqlite';

import type { Book, BookRepository } from '../../domain';

interface BookRow {
	archived_at: null | string;
	created_at: string;
	currency_code: string;
	id: string;
	is_default: number;
	name: string;
}

function toBook(row: BookRow): Book {
	return {
		archivedAt: row.archived_at,
		createdAt: row.created_at,
		currencyCode: row.currency_code,
		id: row.id,
		isDefault: row.is_default === 1,
		name: row.name,
	};
}

class SqliteBookRepository implements BookRepository {
	constructor(private readonly database: Database) {}

	archive(id: string, archivedAt: string): boolean {
		return (
			this.database
				.query('UPDATE books SET archived_at = ? WHERE id = ? AND archived_at IS NULL')
				.run(archivedAt, id).changes > 0
		);
	}

	create(book: Book): void {
		this.database
			.query(
				'INSERT INTO books (id, name, currency_code, is_default, archived_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.run(book.id, book.name, book.currencyCode, book.isDefault ? 1 : 0, book.archivedAt, book.createdAt);
	}

	deleteIfEmpty(id: string): boolean {
		const deleteBook = this.database.transaction(() => {
			const references = ['accounts', 'categories', 'classes', 'transactions', 'transfers', 'statement_imports'];
			for (const table of references) {
				const result = this.database.query(`SELECT 1 FROM ${table} WHERE book_id = ? LIMIT 1`).get(id);
				if (result) {
					return false;
				}
			}

			return this.database.query('DELETE FROM books WHERE id = ?').run(id).changes > 0;
		});

		return deleteBook();
	}

	ensureDefault(book: Book): Book {
		const ensure = this.database.transaction(() => {
			this.database
				.query(
					'INSERT INTO books (id, name, currency_code, is_default, archived_at, created_at) VALUES (?, ?, ?, 1, NULL, ?) ON CONFLICT(id) DO NOTHING'
				)
				.run(book.id, book.name, book.currencyCode, book.createdAt);
			const row = this.database.query('SELECT * FROM books WHERE is_default = 1').get() as BookRow | null;
			if (!row) {
				throw new Error('The default financial book could not be created');
			}

			return toBook(row);
		});

		return ensure();
	}

	find(id: string): Book | undefined {
		const row = this.database.query('SELECT * FROM books WHERE id = ?').get(id) as BookRow | null;

		return row ? toBook(row) : undefined;
	}

	list(): Book[] {
		const rows = this.database
			.query('SELECT * FROM books ORDER BY archived_at IS NOT NULL, is_default DESC, name COLLATE NOCASE, id')
			.all() as BookRow[];

		return rows.map(row => toBook(row));
	}
}

export { SqliteBookRepository };
