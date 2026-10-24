import { randomUUID } from 'node:crypto';

import type {
	ImportFormat,
	RecordStatementImportInput,
	StatementImportRecord,
	StatementImportRepository,
} from '@modules/imports/domain';
import type { Database } from 'bun:sqlite';

interface StatementImportRow {
	account_id: string;
	book_id: string;
	content_hash: string;
	format: ImportFormat;
	id: string;
	imported_at: string;
}

function toRecord(row: StatementImportRow): StatementImportRecord {
	return {
		accountId: row.account_id,
		bookId: row.book_id,
		contentHash: row.content_hash,
		format: row.format,
		id: row.id,
		importedAt: row.imported_at,
	};
}

class SqliteStatementImportRepository implements StatementImportRepository {
	constructor(private readonly database: Database) {}

	countMatching(
		bookId: string,
		accountId: string,
		transactionDate: string,
		amountMinor: number,
		payee: string
	): number {
		const row = this.database
			.query<{ total: number }, [string, string, string, number, string]>(
				`SELECT COUNT(*) AS total FROM transactions
				WHERE book_id = ? AND account_id = ? AND transaction_date = ? AND amount_minor = ? AND payee = ?`
			)
			.get(bookId, accountId, transactionDate, amountMinor, payee);

		return row?.total ?? 0;
	}

	find(bookId: string, accountId: string, contentHash: string): StatementImportRecord | undefined {
		const row = this.database
			.query<StatementImportRow, [string, string, string]>(
				'SELECT id, book_id, account_id, format, content_hash, imported_at FROM statement_imports WHERE book_id = ? AND account_id = ? AND content_hash = ?'
			)
			.get(bookId, accountId, contentHash);

		return row ? toRecord(row) : undefined;
	}

	record(input: RecordStatementImportInput): StatementImportRecord {
		const id = randomUUID();
		this.database
			.query(
				'INSERT INTO statement_imports (id, book_id, account_id, format, content_hash) VALUES (?, ?, ?, ?, ?)'
			)
			.run(id, input.bookId, input.accountId, input.format, input.contentHash);
		const row = this.database
			.query<StatementImportRow, [string]>(
				'SELECT id, book_id, account_id, format, content_hash, imported_at FROM statement_imports WHERE id = ?'
			)
			.get(id);
		if (!row) {
			throw new Error('Recorded import could not be read');
		}

		return toRecord(row);
	}

	// Nested calls become savepoints, so the caller may also wrap this inside a larger transaction.
	runAtomically<T>(work: () => T): T {
		return this.database.transaction(work)();
	}
}

export { SqliteStatementImportRepository };
