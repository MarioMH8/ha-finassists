import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';

import { CreateTransaction } from '../../ledger/application';
import { SqliteLedgerRepository } from '../../ledger/infrastructure';
import { migrateDatabase } from '../../storage/infrastructure';
import {
	ChangeScheduleStatus,
	CreateSchedule,
	GenerateScheduleOccurrences,
	ListSchedules,
	RecordScheduleOccurrence,
} from '../application';
import {
	initializeScheduleSchema,
	SqliteScheduleOccurrenceRepository,
	SqliteScheduleRepository,
} from './sqlite-schedules';

function setup() {
	const database = new Database(':memory:');
	migrateDatabase(database);
	database.query('INSERT INTO books (id, name, currency_code) VALUES (?, ?, ?)').run('book-1', 'One', 'EUR');
	database.query('INSERT INTO books (id, name, currency_code) VALUES (?, ?, ?)').run('book-2', 'Two', 'EUR');
	database
		.query('INSERT INTO accounts (id, book_id, name, kind, opening_balance_minor) VALUES (?, ?, ?, ?, ?)')
		.run('account-1', 'book-1', 'Cash 1', 'checking', 0);
	database
		.query('INSERT INTO accounts (id, book_id, name, kind, opening_balance_minor) VALUES (?, ?, ?, ?, ?)')
		.run('account-2', 'book-2', 'Cash 2', 'checking', 0);
	initializeScheduleSchema(database);
	initializeScheduleSchema(database);

	const schedules = new SqliteScheduleRepository(database);
	const occurrences = new SqliteScheduleOccurrenceRepository(database);
	const ledger = new SqliteLedgerRepository(database);

	return { database, ledger, occurrences, schedules };
}

describe('SQLite schedules', () => {
	it('requires the shared account and ledger schema before initialization', () => {
		const database = new Database(':memory:');
		expect(() => initializeScheduleSchema(database)).toThrow('Initialize the shared storage schema');
		database.close();
	});

	it('initializes its schema independently and idempotently', () => {
		const { database } = setup();
		expect(database.query('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual([
			{ version: 1 },
			{ version: 2 },
			{ version: 3 },
			{ version: 4 },
		]);
		expect(
			database
				.query('SELECT name FROM sqlite_master WHERE type = ? AND name = ?')
				.get('table', 'scheduled_payments')
		).toEqual({ name: 'scheduled_payments' });
		database.close();
	});

	it('generates bounded installments once and marks a finite schedule completed', () => {
		const { database, occurrences, schedules } = setup();
		const schedule = new CreateSchedule(schedules).execute({
			accountId: 'account-1',
			amountMinor: -1250,
			bookId: 'book-1',
			frequency: 'monthly',
			id: 'schedule-1',
			occurrenceLimit: 3,
			startDate: '2025-01-31',
		});
		let id = 0;
		const generate = new GenerateScheduleOccurrences(schedules, occurrences, () => `occ-${String(++id)}`);

		expect(generate.execute('book-1', schedule.id, '2025-12-31', 2).map(item => item.dueDate)).toEqual([
			'2025-01-31',
			'2025-02-28',
		]);
		expect(generate.execute('book-1', schedule.id, '2025-12-31', 2).map(item => item.dueDate)).toEqual([
			'2025-03-31',
		]);
		expect(generate.execute('book-1', schedule.id, '2025-12-31')).toEqual([]);
		expect(schedules.find('book-1', schedule.id)?.status).toBe('completed');
		expect(occurrences.listForSchedule('book-1', schedule.id)).toHaveLength(3);
		database.close();
	});

	it('enforces pause, resume, cancellation, and book-scoped listing', () => {
		const { database, occurrences, schedules } = setup();
		new CreateSchedule(schedules).execute({
			accountId: 'account-1',
			amountMinor: -500,
			bookId: 'book-1',
			frequency: 'daily',
			id: 'schedule-1',
			startDate: '2025-01-01',
		});
		new CreateSchedule(schedules).execute({
			accountId: 'account-2',
			amountMinor: -500,
			bookId: 'book-2',
			frequency: 'daily',
			id: 'schedule-2',
			startDate: '2025-01-01',
		});
		const status = new ChangeScheduleStatus(schedules);
		expect(new ListSchedules(schedules).execute('book-1')).toHaveLength(1);
		expect(status.execute('book-1', 'schedule-1', 'paused').status).toBe('paused');
		expect(
			new GenerateScheduleOccurrences(schedules, occurrences).execute('book-1', 'schedule-1', '2025-01-03')
		).toEqual([]);
		expect(status.execute('book-1', 'schedule-1', 'active').status).toBe('active');
		expect(status.execute('book-1', 'schedule-1', 'canceled').status).toBe('canceled');
		expect(() => status.execute('book-1', 'schedule-1', 'active')).toThrow('Cannot transition');
		expect(() => status.execute('book-2', 'schedule-1', 'paused')).toThrow('not found in this book');
		database.close();
	});

	it('links an existing matching ledger transaction once without creating a transaction', () => {
		const { database, ledger, occurrences, schedules } = setup();
		const schedule = new CreateSchedule(schedules).execute({
			accountId: 'account-1',
			amountMinor: -875,
			bookId: 'book-1',
			frequency: 'one_time',
			id: 'schedule-1',
			startDate: '2025-01-01',
		});
		const [occurrence] = new GenerateScheduleOccurrences(schedules, occurrences, () => 'occ-1').execute(
			'book-1',
			schedule.id,
			'2025-01-01'
		);
		const transaction = new CreateTransaction(ledger).execute({
			accountId: 'account-1',
			amountMinor: -875,
			bookId: 'book-1',
			transactionDate: '2025-01-01',
		});
		const record = new RecordScheduleOccurrence(schedules, occurrences, ledger);

		expect(record.execute('book-1', occurrence.id, transaction.id, '2025-01-02T00:00:00.000Z')).toMatchObject({
			status: 'recorded',
			transactionId: transaction.id,
		});
		expect(record.execute('book-1', occurrence.id, transaction.id).transactionId).toBe(transaction.id);
		expect(database.query('SELECT COUNT(*) AS count FROM transactions').get()).toEqual({ count: 1 });
		expect(() => record.execute('book-1', occurrence.id, 'not-a-transaction')).toThrow('not found in this book');
		database.close();
	});

	it('prevents one ledger transaction from being linked to multiple occurrences', () => {
		const { database, ledger, occurrences, schedules } = setup();
		const schedule = new CreateSchedule(schedules).execute({
			accountId: 'account-1',
			amountMinor: -100,
			bookId: 'book-1',
			frequency: 'daily',
			id: 'schedule-1',
			startDate: '2025-01-01',
		});
		let id = 0;
		const generated = new GenerateScheduleOccurrences(schedules, occurrences, () => `occ-${String(++id)}`).execute(
			'book-1',
			schedule.id,
			'2025-01-02'
		);
		const transaction = new CreateTransaction(ledger).execute({
			accountId: 'account-1',
			amountMinor: -100,
			bookId: 'book-1',
			transactionDate: '2025-01-01',
		});
		const record = new RecordScheduleOccurrence(schedules, occurrences, ledger);

		record.execute('book-1', generated[0].id, transaction.id);
		expect(() => record.execute('book-1', generated[1].id, transaction.id)).toThrow('already recorded');
		database.close();
	});

	it('rejects cross-book accounts, links, and mismatched ledger values', () => {
		const { database, ledger, occurrences, schedules } = setup();
		const create = new CreateSchedule(schedules);
		expect(() =>
			create.execute({
				accountId: 'account-2',
				amountMinor: -100,
				bookId: 'book-1',
				frequency: 'one_time',
				id: 'invalid-account',
				startDate: '2025-01-01',
			})
		).toThrow();
		const schedule = create.execute({
			accountId: 'account-1',
			amountMinor: -100,
			bookId: 'book-1',
			frequency: 'one_time',
			id: 'schedule-1',
			startDate: '2025-01-01',
		});
		const [occurrence] = new GenerateScheduleOccurrences(schedules, occurrences, () => 'occ-1').execute(
			'book-1',
			schedule.id,
			'2025-01-01'
		);
		const otherBookTransaction = new CreateTransaction(ledger).execute({
			accountId: 'account-2',
			amountMinor: -100,
			bookId: 'book-2',
			transactionDate: '2025-01-01',
		});
		const wrongAmount = new CreateTransaction(ledger).execute({
			accountId: 'account-1',
			amountMinor: -101,
			bookId: 'book-1',
			transactionDate: '2025-01-01',
		});
		const record = new RecordScheduleOccurrence(schedules, occurrences, ledger);

		expect(() => record.execute('book-1', occurrence.id, otherBookTransaction.id)).toThrow(
			'not found in this book'
		);
		expect(() => record.execute('book-1', occurrence.id, wrongAmount.id)).toThrow('account and amount must match');
		expect(occurrences.find('book-2', occurrence.id)).toBeUndefined();
		database.close();
	});
});
