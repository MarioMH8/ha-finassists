import type {
	TransactionCriteria,
	TransactionDeleteCriteria,
	TransactionPage,
	TransactionRepository,
} from '@modules/ledger/domain';
import { Transaction } from '@modules/ledger/domain';
import type { Database, SQLQueryBindings } from 'bun:sqlite';

import type { TransactionRow } from './mappers/sqlite-transaction.mapper';
import { SqliteTransactionMapper } from './mappers/sqlite-transaction.mapper';
import { SqliteTransactionQueries } from './queries/sqlite-transaction-queries';

const DEFAULT_LIMIT = 100;

export class SqliteLedgerRepository implements TransactionRepository {
	constructor(private readonly database: Database) {}

	async delete({ id }: TransactionDeleteCriteria): Promise<boolean> {
		const result = this.database.query('DELETE FROM transactions WHERE id = ?').run(id);
		await Promise.resolve();

		return result.changes > 0;
	}

	async deleteMany(ids: string[]): Promise<number> {
		if (ids.length === 0) {
			return 0;
		}
		const placeholders = ids.map(() => '?').join(', ');
		const result = this.database.query(`DELETE FROM transactions WHERE id IN (${placeholders})`).run(...ids);
		await Promise.resolve();

		return result.changes;
	}

	async findById(id: string): Promise<Transaction | undefined> {
		const row = this.database
			.query<TransactionRow, [string]>(
				`SELECT id, kind, amount_minor, currency_code, description, transaction_date, category_id, actor_id, created_at
				 FROM transactions WHERE id = ?`
			)
			.get(id);
		await Promise.resolve();

		return row === null ? undefined : SqliteTransactionMapper.toDomain(row);
	}

	async save(transaction: Transaction): Promise<void> {
		this.database
			.query(
				`INSERT INTO transactions
					(id, kind, amount_minor, currency_code, description, transaction_date, category_id, actor_id, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(
				transaction.id,
				transaction.kind,
				transaction.amountMinor,
				transaction.currencyCode,
				transaction.description,
				transaction.transactionDate,
				transaction.categoryId,
				transaction.actorId,
				transaction.createdAt
			);
		await Promise.resolve();
	}

	async search(criteria: TransactionCriteria = {}): Promise<TransactionPage> {
		const { parameters, sql } = SqliteTransactionQueries.where(criteria);
		const { total } = this.database
			.query<{ total: number }, SQLQueryBindings[]>(`SELECT COUNT(*) AS total FROM transactions${sql}`)
			.get(...parameters) ?? { total: 0 };
		const rows = this.database
			.query<TransactionRow, SQLQueryBindings[]>(
				`SELECT id, kind, amount_minor, currency_code, description, transaction_date, category_id, actor_id, created_at
				 FROM transactions${sql}
				 ORDER BY transaction_date DESC, created_at DESC, id DESC
				 LIMIT ? OFFSET ?`
			)
			.all(...parameters, criteria.limit ?? DEFAULT_LIMIT, criteria.offset ?? 0);
		await Promise.resolve();

		return { items: rows.map(row => SqliteTransactionMapper.toDomain(row)), total };
	}

	async update(transaction: Transaction): Promise<boolean> {
		const result = this.database
			.query(
				`UPDATE transactions
				 SET kind = ?, amount_minor = ?, currency_code = ?, description = ?, transaction_date = ?, category_id = ?, actor_id = ?, created_at = ?
				 WHERE id = ?`
			)
			.run(
				transaction.kind,
				transaction.amountMinor,
				transaction.currencyCode,
				transaction.description,
				transaction.transactionDate,
				transaction.categoryId,
				transaction.actorId,
				transaction.createdAt,
				transaction.id
			);
		await Promise.resolve();

		return result.changes > 0;
	}
}
