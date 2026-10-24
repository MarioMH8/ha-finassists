import type {
	AccountCriteria,
	AccountDeleteCriteria,
	AccountKind,
	AccountRepository,
	AccountTransactionTotalsCriteria,
	AccountTransactionTotalsQuery,
	TransactionTotals,
} from '@modules/accounts/domain';
import { Account, AccountIdentityConflictError } from '@modules/accounts/domain';
import type { Database, SQLQueryBindings } from 'bun:sqlite';

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
	return Account.restore({
		bookId: row.book_id,
		closedAt: row.closed_at,
		createdAt: row.created_at,
		id: row.id,
		kind: row.kind,
		name: row.name,
		openingBalanceMinor: row.opening_balance_minor,
	});
}

function where(criteria: AccountCriteria): { parameters: SQLQueryBindings[]; sql: string } {
	const clauses: string[] = [];
	const parameters: SQLQueryBindings[] = [];

	function add(column: string, value: null | number | string | undefined): void {
		if (value === undefined) {
			return;
		}
		if (value === null) {
			clauses.push(`${column} IS NULL`);

			return;
		}

		clauses.push(`${column} = ?`);
		parameters.push(value);
	}

	add('book_id', criteria.bookId);
	if (criteria.closed !== undefined) {
		clauses.push(criteria.closed ? 'closed_at IS NOT NULL' : 'closed_at IS NULL');
	}
	add('created_at', criteria.createdAt);
	add('id', criteria.id);
	add('kind', criteria.kind);
	add('name', criteria.name);
	add('opening_balance_minor', criteria.openingBalanceMinor);

	return { parameters, sql: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '' };
}

class SqliteAccountRepository implements AccountRepository, AccountTransactionTotalsQuery {
	constructor(private readonly database: Database) {}

	delete({ bookId, id }: AccountDeleteCriteria): boolean {
		try {
			return this.database.query('DELETE FROM accounts WHERE book_id = ? AND id = ?').run(bookId, id).changes > 0;
		} catch (error) {
			if (error instanceof Error && error.message.includes('FOREIGN KEY constraint failed')) {
				return false;
			}

			throw error;
		}
	}

	find(criteria: AccountCriteria): Account | undefined {
		return this.search(criteria)[0];
	}

	save(account: Account): void {
		const save = this.database.transaction(() => {
			const existing = this.database
				.query<{ book_id: string }, [string]>('SELECT book_id FROM accounts WHERE id = ?')
				.get(account.id);
			if (existing && existing.book_id !== account.bookId) {
				throw new AccountIdentityConflictError();
			}

			this.database
				.query(
					`INSERT INTO accounts (id, book_id, name, kind, opening_balance_minor, closed_at, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?)
					ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind,
					opening_balance_minor = excluded.opening_balance_minor, closed_at = excluded.closed_at,
					created_at = excluded.created_at WHERE accounts.book_id = excluded.book_id`
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
		});

		save();
	}

	search(criteria: AccountCriteria = {}): Account[] {
		const filter = where(criteria);
		const rows = this.database
			.query<AccountRow, SQLQueryBindings[]>(
				`SELECT * FROM accounts${filter.sql} ORDER BY closed_at IS NOT NULL, name COLLATE NOCASE, id`
			)
			.all(...filter.parameters);

		return rows.map(row => toAccount(row));
	}

	sumByStatus({ accountId, asOf, bookId }: AccountTransactionTotalsCriteria): TransactionTotals {
		const dateFilter = asOf === undefined ? '' : 'AND substr(transaction_date, 1, 10) <= ?';
		const parameters = asOf === undefined ? [bookId, accountId] : [bookId, accountId, asOf];
		const rows = this.database
			.query<StatusTotalRow, SQLQueryBindings[]>(
				`SELECT status, SUM(amount_minor) AS total FROM transactions WHERE book_id = ? AND account_id = ? ${dateFilter} GROUP BY status`
			)
			.all(...parameters);

		const totals: TransactionTotals = { cleared: 0, reconciled: 0, uncleared: 0 };
		for (const row of rows) {
			totals[row.status] = row.total;
		}

		return totals;
	}
}

export { SqliteAccountRepository };
