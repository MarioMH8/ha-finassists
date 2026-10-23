import type { Database } from 'bun:sqlite';

import type { Account, AccountKind, AccountRepository, ListAccountsOptions, TransactionTotals } from '../../domain';

interface AccountRow {
	book_id: string;
	closed_at: null | string;
	created_at: string;
	id: string;
	kind: AccountKind;
	name: string;
	opening_balance_minor: number;
}

interface StatusTotalRow {
	status: keyof TransactionTotals;
	total: number;
}

function toAccount(row: AccountRow): Account {
	return {
		bookId: row.book_id,
		closedAt: row.closed_at,
		createdAt: row.created_at,
		id: row.id,
		kind: row.kind,
		name: row.name,
		openingBalanceMinor: row.opening_balance_minor,
	};
}

class SqliteAccountRepository implements AccountRepository {
	constructor(private readonly database: Database) {}

	close(bookId: string, id: string, closedAt: string): boolean {
		return (
			this.database
				.query('UPDATE accounts SET closed_at = ? WHERE book_id = ? AND id = ? AND closed_at IS NULL')
				.run(closedAt, bookId, id).changes > 0
		);
	}

	create(account: Account): void {
		this.database
			.query(
				'INSERT INTO accounts (id, book_id, name, kind, opening_balance_minor, closed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
			)
			.run(
				account.id,
				account.bookId,
				account.name,
				account.kind,
				account.openingBalanceMinor,
				account.closedAt,
				account.createdAt
			);
	}

	find(bookId: string, id: string): Account | undefined {
		const row = this.database
			.query('SELECT * FROM accounts WHERE book_id = ? AND id = ?')
			.get(bookId, id) as AccountRow | null;

		return row ? toAccount(row) : undefined;
	}

	list(bookId: string, options: ListAccountsOptions = {}): Account[] {
		const closedFilter = options.includeClosed ? '' : 'AND closed_at IS NULL';
		const rows = this.database
			.query(
				`SELECT * FROM accounts WHERE book_id = ? ${closedFilter} ORDER BY closed_at IS NOT NULL, name COLLATE NOCASE, id`
			)
			.all(bookId) as AccountRow[];

		return rows.map(row => toAccount(row));
	}

	reopen(bookId: string, id: string): boolean {
		return (
			this.database
				.query('UPDATE accounts SET closed_at = NULL WHERE book_id = ? AND id = ? AND closed_at IS NOT NULL')
				.run(bookId, id).changes > 0
		);
	}

	sumTransactionsByStatus(bookId: string, accountId: string, asOf?: string): TransactionTotals {
		const dateFilter = asOf === undefined ? '' : 'AND substr(transaction_date, 1, 10) <= ?';
		const parameters = asOf === undefined ? [bookId, accountId] : [bookId, accountId, asOf];
		const rows = this.database
			.query(
				`SELECT status, SUM(amount_minor) AS total FROM transactions WHERE book_id = ? AND account_id = ? ${dateFilter} GROUP BY status`
			)
			.all(...parameters) as StatusTotalRow[];

		const totals: TransactionTotals = { cleared: 0, reconciled: 0, uncleared: 0 };
		for (const row of rows) {
			totals[row.status] = row.total;
		}

		return totals;
	}
}

export { SqliteAccountRepository };
