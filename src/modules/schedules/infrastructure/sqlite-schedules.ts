import type { Database, SQLQueryBindings } from 'bun:sqlite';

import type { ScheduledPayment, ScheduleFrequency, ScheduleStatus } from '../domain/schedule';
import type { ScheduleCriteria, ScheduleRepository } from '../domain/schedule.repository';
import type { LedgerTransactionReference, ScheduleOccurrence } from '../domain/schedule-occurrence';
import type { ScheduleOccurrenceRepository } from '../domain/schedule-occurrence.repository';

interface ScheduleRow {
	account_id: string;
	amount_minor: number;
	book_id: string;
	created_at: string;
	end_date: null | string;
	frequency: ScheduleFrequency;
	id: string;
	interval: number;
	memo: string;
	occurrence_limit: null | number;
	payee: string;
	start_date: string;
	status: ScheduleStatus;
}

interface OccurrenceRow {
	account_id: string;
	amount_minor: number;
	book_id: string;
	created_at: string;
	due_date: string;
	id: string;
	memo: string;
	occurrence_number: number;
	payee: string;
	recorded_at: null | string;
	schedule_id: string;
	status: ScheduleOccurrence['status'];
	transaction_id: null | string;
}

function toNullableSqlBinding(value: number | string | undefined): SQLQueryBindings {
	return value as SQLQueryBindings;
}

function toSchedule(row: ScheduleRow): ScheduledPayment {
	return {
		accountId: row.account_id,
		amountMinor: row.amount_minor,
		bookId: row.book_id,
		createdAt: row.created_at,
		endDate: row.end_date ?? undefined,
		frequency: row.frequency,
		id: row.id,
		interval: row.interval,
		memo: row.memo,
		occurrenceLimit: row.occurrence_limit ?? undefined,
		payee: row.payee,
		startDate: row.start_date,
		status: row.status,
	};
}

function where(criteria: ScheduleCriteria): { parameters: SQLQueryBindings[]; sql: string } {
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

	add('account_id', criteria.accountId);
	add('amount_minor', criteria.amountMinor);
	add('book_id', criteria.bookId);
	add('created_at', criteria.createdAt);
	add('end_date', criteria.endDate);
	add('frequency', criteria.frequency);
	add('id', criteria.id);
	add('interval', criteria.interval);
	add('memo', criteria.memo);
	add('occurrence_limit', criteria.occurrenceLimit);
	add('payee', criteria.payee);
	add('start_date', criteria.startDate);
	add('status', criteria.status);

	return { parameters, sql: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '' };
}

function toOccurrence(row: OccurrenceRow): ScheduleOccurrence {
	return {
		accountId: row.account_id,
		amountMinor: row.amount_minor,
		bookId: row.book_id,
		createdAt: row.created_at,
		dueDate: row.due_date,
		id: row.id,
		memo: row.memo,
		occurrenceNumber: row.occurrence_number,
		payee: row.payee,
		recordedAt: row.recorded_at ?? undefined,
		scheduleId: row.schedule_id,
		status: row.status,
		transactionId: row.transaction_id ?? undefined,
	};
}

class SqliteScheduleRepository implements ScheduleRepository {
	constructor(private readonly database: Database) {}

	find(criteria: ScheduleCriteria): ScheduledPayment | undefined {
		return this.search(criteria)[0];
	}

	save(schedule: ScheduledPayment): void {
		this.database
			.query(
				`INSERT INTO scheduled_payments
					(id, book_id, account_id, frequency, interval, start_date, end_date, occurrence_limit, amount_minor, payee, memo, status, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT (book_id, id) DO UPDATE SET
					account_id = excluded.account_id, frequency = excluded.frequency, interval = excluded.interval,
					start_date = excluded.start_date, end_date = excluded.end_date, occurrence_limit = excluded.occurrence_limit,
					amount_minor = excluded.amount_minor, payee = excluded.payee, memo = excluded.memo, status = excluded.status`
			)
			.run(
				schedule.id,
				schedule.bookId,
				schedule.accountId,
				schedule.frequency,
				schedule.interval,
				schedule.startDate,
				toNullableSqlBinding(schedule.endDate),
				toNullableSqlBinding(schedule.occurrenceLimit),
				schedule.amountMinor,
				schedule.payee,
				schedule.memo,
				schedule.status,
				schedule.createdAt
			);
	}

	search(criteria: ScheduleCriteria = {}): ScheduledPayment[] {
		const filter = where(criteria);
		const rows = this.database
			.query<ScheduleRow, SQLQueryBindings[]>(
				`SELECT * FROM scheduled_payments${filter.sql} ORDER BY start_date, id`
			)
			.all(...filter.parameters);

		return rows.map(row => toSchedule(row));
	}
}

class SqliteScheduleOccurrenceRepository implements ScheduleOccurrenceRepository {
	constructor(private readonly database: Database) {}

	createIfAbsent(occurrence: ScheduleOccurrence): boolean {
		return (
			this.database
				.query(
					`INSERT INTO scheduled_payment_occurrences
						(id, book_id, schedule_id, account_id, occurrence_number, due_date, amount_minor, payee, memo, status, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					ON CONFLICT DO NOTHING`
				)
				.run(
					occurrence.id,
					occurrence.bookId,
					occurrence.scheduleId,
					occurrence.accountId,
					occurrence.occurrenceNumber,
					occurrence.dueDate,
					occurrence.amountMinor,
					occurrence.payee,
					occurrence.memo,
					occurrence.status,
					occurrence.createdAt
				).changes > 0
		);
	}

	find(bookId: string, id: string): ScheduleOccurrence | undefined {
		const row = this.database
			.query('SELECT * FROM scheduled_payment_occurrences WHERE book_id = ? AND id = ?')
			.get(bookId, id) as null | OccurrenceRow;

		return row ? toOccurrence(row) : undefined;
	}

	linkTransaction(
		bookId: string,
		occurrenceId: string,
		transaction: LedgerTransactionReference,
		recordedAt: string
	): ScheduleOccurrence | undefined {
		if (transaction.bookId !== bookId) {
			return undefined;
		}

		const link = this.database.transaction(() => {
			const occurrenceRow = this.database
				.query('SELECT * FROM scheduled_payment_occurrences WHERE book_id = ? AND id = ?')
				.get(bookId, occurrenceId) as null | OccurrenceRow;
			if (!occurrenceRow) {
				return;
			}
			if (occurrenceRow.status === 'recorded') {
				return occurrenceRow.transaction_id === transaction.id ? toOccurrence(occurrenceRow) : undefined;
			}
			if (
				occurrenceRow.status !== 'pending' ||
				occurrenceRow.account_id !== transaction.accountId ||
				occurrenceRow.amount_minor !== transaction.amountMinor
			) {
				return;
			}

			const transactionRow = this.database
				.query('SELECT account_id, amount_minor FROM transactions WHERE book_id = ? AND id = ?')
				.get(bookId, transaction.id) as null | { account_id: string; amount_minor: number };
			if (
				transactionRow?.account_id !== transaction.accountId ||
				transactionRow.amount_minor !== transaction.amountMinor
			) {
				return;
			}
			const alreadyLinked = this.database
				.query('SELECT 1 FROM scheduled_payment_occurrences WHERE book_id = ? AND transaction_id = ?')
				.get(bookId, transaction.id);
			if (alreadyLinked) {
				return;
			}

			const result = this.database
				.query(
					`UPDATE scheduled_payment_occurrences
					SET status = 'recorded', transaction_id = ?, recorded_at = ?
					WHERE book_id = ? AND id = ? AND status = 'pending' AND transaction_id IS NULL`
				)
				.run(transaction.id, recordedAt, bookId, occurrenceId);
			if (result.changes === 0) {
				return;
			}

			return this.find(bookId, occurrenceId);
		});

		return link();
	}

	listForSchedule(bookId: string, scheduleId: string): ScheduleOccurrence[] {
		const rows = this.database
			.query(
				`SELECT * FROM scheduled_payment_occurrences
					WHERE book_id = ? AND schedule_id = ? ORDER BY occurrence_number`
			)
			.all(bookId, scheduleId) as OccurrenceRow[];

		return rows.map(row => toOccurrence(row));
	}
}

function initializeScheduleSchema(database: Database): void {
	const requiredTables = ['accounts', 'transactions'];
	for (const table of requiredTables) {
		const existing = database.query('SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?').get('table', table);
		if (!existing) {
			throw new Error(`Initialize the shared storage schema before schedules (missing ${table} table)`);
		}
	}

	database.run('PRAGMA foreign_keys = ON');
	database.run(`
		CREATE TABLE IF NOT EXISTS scheduled_payments (
			id TEXT NOT NULL,
			book_id TEXT NOT NULL,
			account_id TEXT NOT NULL,
			frequency TEXT NOT NULL CHECK (frequency IN ('one_time', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
			interval INTEGER NOT NULL CHECK (typeof(interval) = 'integer' AND interval > 0),
			start_date TEXT NOT NULL,
			end_date TEXT,
			occurrence_limit INTEGER CHECK (occurrence_limit IS NULL OR (typeof(occurrence_limit) = 'integer' AND occurrence_limit > 0)),
			amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor != 0 AND amount_minor BETWEEN -9007199254740991 AND 9007199254740991),
			payee TEXT NOT NULL DEFAULT '' CHECK (length(payee) <= 120),
			memo TEXT NOT NULL DEFAULT '' CHECK (length(memo) <= 500),
			status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'canceled', 'completed')),
			created_at TEXT NOT NULL,
			PRIMARY KEY (book_id, id),
			CHECK (end_date IS NULL OR end_date >= start_date),
			CHECK (frequency != 'one_time' OR (interval = 1 AND occurrence_limit = 1)),
			FOREIGN KEY (book_id, account_id) REFERENCES accounts(book_id, id) ON DELETE RESTRICT
		)
	`);
	database.run(`
		CREATE TABLE IF NOT EXISTS scheduled_payment_occurrences (
			id TEXT NOT NULL,
			book_id TEXT NOT NULL,
			schedule_id TEXT NOT NULL,
			account_id TEXT NOT NULL,
			occurrence_number INTEGER NOT NULL CHECK (typeof(occurrence_number) = 'integer' AND occurrence_number >= 0),
			due_date TEXT NOT NULL,
			amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor != 0 AND amount_minor BETWEEN -9007199254740991 AND 9007199254740991),
			payee TEXT NOT NULL,
			memo TEXT NOT NULL,
			status TEXT NOT NULL CHECK (status IN ('pending', 'recorded', 'skipped')),
			transaction_id TEXT,
			recorded_at TEXT,
			created_at TEXT NOT NULL,
			PRIMARY KEY (book_id, id),
			UNIQUE (book_id, schedule_id, occurrence_number),
			UNIQUE (book_id, transaction_id),
			CHECK ((status = 'recorded' AND transaction_id IS NOT NULL AND recorded_at IS NOT NULL) OR
				(status != 'recorded' AND transaction_id IS NULL AND recorded_at IS NULL)),
			FOREIGN KEY (book_id, schedule_id) REFERENCES scheduled_payments(book_id, id) ON DELETE RESTRICT,
			FOREIGN KEY (book_id, account_id) REFERENCES accounts(book_id, id) ON DELETE RESTRICT,
			FOREIGN KEY (book_id, transaction_id) REFERENCES transactions(book_id, id) ON DELETE RESTRICT
		)
	`);
	database.run(
		'CREATE INDEX IF NOT EXISTS scheduled_payments_book_status_index ON scheduled_payments(book_id, status, start_date, id)'
	);
	database.run(
		'CREATE INDEX IF NOT EXISTS scheduled_occurrences_schedule_date_index ON scheduled_payment_occurrences(book_id, schedule_id, due_date, occurrence_number)'
	);
}

export { initializeScheduleSchema, SqliteScheduleOccurrenceRepository, SqliteScheduleRepository };
