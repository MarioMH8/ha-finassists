import type {
	ScheduledOccurrencePosting,
	ScheduledPostingRepository,
	ScheduledTransactionCriteria,
	ScheduledTransactionPage,
	ScheduledTransactionRepository,
} from '@modules/ledger/domain';
import { ScheduledTransaction } from '@modules/ledger/domain';
import type { Database, SQLQueryBindings } from 'bun:sqlite';

import type { ScheduledTransactionRow } from './mappers/sqlite-scheduled-transaction.mapper';
import { SqliteScheduledTransactionMapper } from './mappers/sqlite-scheduled-transaction.mapper';
import { SqliteScheduledTransactionQueries } from './queries/sqlite-scheduled-transaction-queries';

const DEFAULT_LIMIT = 100;
const SELECT_COLUMNS = `id, kind, amount_minor, currency_code, description, category_id, start_date,
	frequency, interval, end_date, next_due_date, occurrence_number, posting_mode, status,
	created_by, created_at, version`;

class ScheduledTransactionVersionConflict extends Error {}

export class SqliteScheduledTransactionRepository
	implements ScheduledPostingRepository, ScheduledTransactionRepository
{
	constructor(private readonly database: Database) {}

	async delete(id: string): Promise<boolean> {
		const result = this.database.query('DELETE FROM scheduled_transactions WHERE id = ?').run(id);
		await Promise.resolve();

		return result.changes > 0;
	}

	async findById(id: string): Promise<ScheduledTransaction | undefined> {
		const row = this.database
			.query<ScheduledTransactionRow, [string]>(
				`SELECT ${SELECT_COLUMNS} FROM scheduled_transactions WHERE id = ?`
			)
			.get(id);
		await Promise.resolve();

		return row === null ? undefined : SqliteScheduledTransactionMapper.toDomain(row);
	}

	async save(schedule: ScheduledTransaction): Promise<void> {
		this.database
			.query(
				`INSERT INTO scheduled_transactions
				 (id, kind, amount_minor, currency_code, description, category_id, start_date, frequency, interval,
				  end_date, next_due_date, occurrence_number, posting_mode, status, created_by, created_at, version)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(
				schedule.id,
				schedule.kind,
				schedule.amountMinor,
				schedule.currencyCode,
				schedule.description,
				schedule.categoryId,
				schedule.startDate,
				schedule.frequency,
				schedule.interval,
				schedule.endDate,
				schedule.nextDueDate,
				schedule.occurrenceNumber,
				schedule.postingMode,
				schedule.status,
				schedule.createdBy,
				schedule.createdAt,
				schedule.version
			);
		await Promise.resolve();
	}

	async savePostedOccurrence(posting: ScheduledOccurrencePosting): Promise<boolean> {
		try {
			this.database.transaction(() => {
				const updated = this.database
					.query(
						`UPDATE scheduled_transactions
						 SET next_due_date = ?, occurrence_number = ?, status = ?, version = version + 1
						 WHERE id = ? AND version = ?`
					)
					.run(
						posting.schedule.nextDueDate,
						posting.schedule.occurrenceNumber,
						posting.schedule.status,
						posting.schedule.id,
						posting.expectedVersion
					);
				if (updated.changes !== 1) {
					throw new ScheduledTransactionVersionConflict();
				}
				this.database
					.query(
						`INSERT INTO transactions
						 (id, kind, amount_minor, currency_code, description, transaction_date, category_id, actor_id,
						  created_at, schedule_id, schedule_occurrence_number)
						 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.run(
						posting.transaction.id,
						posting.transaction.kind,
						posting.transaction.amountMinor,
						posting.transaction.currencyCode,
						posting.transaction.description,
						posting.transaction.transactionDate,
						posting.transaction.categoryId,
						posting.transaction.actorId,
						posting.transaction.createdAt,
						posting.schedule.id,
						posting.occurrenceNumber
					);
			})();
		} catch (error) {
			if (error instanceof ScheduledTransactionVersionConflict) {
				await Promise.resolve();

				return false;
			}
			throw error;
		}
		await Promise.resolve();

		return true;
	}

	async search(criteria: ScheduledTransactionCriteria = {}): Promise<ScheduledTransactionPage> {
		const { parameters, sql } = SqliteScheduledTransactionQueries.where(criteria);
		const { total } = this.database
			.query<{ total: number }, SQLQueryBindings[]>(`SELECT COUNT(*) AS total FROM scheduled_transactions${sql}`)
			.get(...parameters) ?? { total: 0 };
		const rows = this.database
			.query<ScheduledTransactionRow, SQLQueryBindings[]>(
				`SELECT ${SELECT_COLUMNS} FROM scheduled_transactions${sql}
				 ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
				          COALESCE(next_due_date, '9999-12-31') ASC, created_at ASC, id ASC
				 LIMIT ? OFFSET ?`
			)
			.all(...parameters, criteria.limit ?? DEFAULT_LIMIT, criteria.offset ?? 0);
		await Promise.resolve();

		return { items: rows.map(row => SqliteScheduledTransactionMapper.toDomain(row)), total };
	}

	async update(schedule: ScheduledTransaction, expectedVersion: number): Promise<boolean> {
		const result = this.database
			.query(
				`UPDATE scheduled_transactions
				 SET kind = ?, amount_minor = ?, currency_code = ?, description = ?, category_id = ?,
				     start_date = ?, frequency = ?, interval = ?, end_date = ?, next_due_date = ?,
				     occurrence_number = ?, posting_mode = ?, status = ?, created_by = ?, created_at = ?,
				     version = version + 1
				 WHERE id = ? AND version = ?`
			)
			.run(
				schedule.kind,
				schedule.amountMinor,
				schedule.currencyCode,
				schedule.description,
				schedule.categoryId,
				schedule.startDate,
				schedule.frequency,
				schedule.interval,
				schedule.endDate,
				schedule.nextDueDate,
				schedule.occurrenceNumber,
				schedule.postingMode,
				schedule.status,
				schedule.createdBy,
				schedule.createdAt,
				schedule.id,
				expectedVersion
			);
		await Promise.resolve();

		return result.changes > 0;
	}
}
