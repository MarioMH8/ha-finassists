import type { Database, SQLQueryBindings } from 'bun:sqlite';

import type {
	TransactionCriteria,
	TransactionDeleteCriteria,
	TransactionKind,
	TransactionPage,
	TransactionRepository,
} from '../../domain';
import { Transaction } from '../../domain';

interface TransactionRow {
	actor_id: null | string;
	amount_minor: number;
	created_at: string;
	currency_code: string;
	description: string;
	id: string;
	kind: TransactionKind;
	transaction_date: string;
}

const DEFAULT_LIMIT = 100;

function where(criteria: TransactionCriteria): { parameters: SQLQueryBindings[]; sql: string } {
	const clauses: string[] = [];
	const parameters: SQLQueryBindings[] = [];

	if (criteria.kind !== undefined) {
		clauses.push('kind = ?');
		parameters.push(criteria.kind);
	}
	if (criteria.fromDate !== undefined) {
		clauses.push('transaction_date >= ?');
		parameters.push(criteria.fromDate);
	}
	if (criteria.toDate !== undefined) {
		clauses.push('transaction_date <= ?');
		parameters.push(criteria.toDate);
	}

	return { parameters, sql: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '' };
}

function toTransaction(row: TransactionRow): Transaction {
	return Transaction.create({
		actorId: row.actor_id,
		amountMinor: row.amount_minor,
		createdAt: row.created_at,
		currencyCode: row.currency_code,
		description: row.description,
		id: row.id,
		kind: row.kind,
		transactionDate: row.transaction_date,
	});
}

export class SqliteLedgerRepository implements TransactionRepository {
	constructor(private readonly database: Database) {}

	async delete({ id }: TransactionDeleteCriteria): Promise<boolean> {
		const result = this.database.query('DELETE FROM transactions WHERE id = ?').run(id);
		await Promise.resolve();

		return result.changes > 0;
	}

	async save(transaction: Transaction): Promise<void> {
		this.database
			.query(
				`INSERT INTO transactions
					(id, kind, amount_minor, currency_code, description, transaction_date, actor_id, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(
				transaction.id,
				transaction.kind,
				transaction.amountMinor,
				transaction.currencyCode,
				transaction.description,
				transaction.transactionDate,
				transaction.actorId,
				transaction.createdAt
			);
		await Promise.resolve();
	}

	async search(criteria: TransactionCriteria = {}): Promise<TransactionPage> {
		const { parameters, sql } = where(criteria);
		const { total } = this.database
			.query<{ total: number }, SQLQueryBindings[]>(`SELECT COUNT(*) AS total FROM transactions${sql}`)
			.get(...parameters) ?? { total: 0 };
		const rows = this.database
			.query<TransactionRow, SQLQueryBindings[]>(
				`SELECT id, kind, amount_minor, currency_code, description, transaction_date, actor_id, created_at
				 FROM transactions${sql}
				 ORDER BY transaction_date DESC, created_at DESC, id DESC
				 LIMIT ? OFFSET ?`
			)
			.all(...parameters, criteria.limit ?? DEFAULT_LIMIT, criteria.offset ?? 0);
		await Promise.resolve();

		return { items: rows.map(row => toTransaction(row)), total };
	}
}
