import type {
	ScheduledOccurrencePosting,
	ScheduledPostingRepository,
	ScheduledTransactionCriteria,
	ScheduledTransactionFrequency,
	ScheduledTransactionPage,
	ScheduledTransactionPostingMode,
	ScheduledTransactionRepository,
	ScheduledTransactionStatus,
	TransactionKind,
} from '@modules/ledger/domain';
import { ScheduledTransaction } from '@modules/ledger/domain';
import type { Database, SQLQueryBindings } from 'bun:sqlite';

interface ScheduledTransactionRow {
	amount_minor: number;
	category_id: null | string;
	created_at: string;
	created_by: null | string;
	currency_code: string;
	description: string;
	end_date: null | string;
	frequency: ScheduledTransactionFrequency;
	id: string;
	interval: number;
	kind: TransactionKind;
	next_due_date: null | string;
	occurrence_number: number;
	posting_mode: ScheduledTransactionPostingMode;
	start_date: string;
	status: ScheduledTransactionStatus;
	version: number;
}

const DEFAULT_LIMIT = 100;
const SELECT_COLUMNS = `id, kind, amount_minor, currency_code, description, category_id, start_date,
	frequency, interval, end_date, next_due_date, occurrence_number, posting_mode, status,
	created_by, created_at, version`;

class ScheduledTransactionVersionConflict extends Error {}

function escapeLike(value: string): string {
	return value
		.replaceAll('\\', '\\\\')
		.replaceAll('%', String.raw`\%`)
		.replaceAll('_', String.raw`\_`);
}

function where(criteria: ScheduledTransactionCriteria): { parameters: SQLQueryBindings[]; sql: string } {
	const clauses: string[] = [];
	const parameters: SQLQueryBindings[] = [];
	if (criteria.kind !== undefined) {
		clauses.push('kind = ?');
		parameters.push(criteria.kind);
	}
	if (criteria.categoryId !== undefined) {
		clauses.push('category_id = ?');
		parameters.push(criteria.categoryId);
	}
	if (criteria.status !== undefined) {
		clauses.push('status = ?');
		parameters.push(criteria.status);
	}
	if (criteria.postingMode !== undefined) {
		clauses.push('posting_mode = ?');
		parameters.push(criteria.postingMode);
	}
	if (criteria.dueThrough !== undefined) {
		clauses.push('next_due_date IS NOT NULL AND next_due_date <= ?');
		parameters.push(criteria.dueThrough);
	}
	const search = criteria.search?.trim();
	if (search !== undefined && search !== '') {
		clauses.push(String.raw`description COLLATE NOCASE LIKE ? ESCAPE '\'`);
		parameters.push(`%${escapeLike(search)}%`);
	}

	return { parameters, sql: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '' };
}

function toScheduledTransaction(row: ScheduledTransactionRow): ScheduledTransaction {
	return ScheduledTransaction.restore({
		amountMinor: row.amount_minor,
		categoryId: row.category_id,
		createdAt: row.created_at,
		createdBy: row.created_by,
		currencyCode: row.currency_code,
		description: row.description,
		endDate: row.end_date,
		frequency: row.frequency,
		id: row.id,
		interval: row.interval,
		kind: row.kind,
		nextDueDate: row.next_due_date,
		occurrenceNumber: row.occurrence_number,
		postingMode: row.posting_mode,
		startDate: row.start_date,
		status: row.status,
		version: row.version,
	});
}

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

		return row === null ? undefined : toScheduledTransaction(row);
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
		const { parameters, sql } = where(criteria);
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

		return { items: rows.map(row => toScheduledTransaction(row)), total };
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
