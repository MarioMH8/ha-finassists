import { CategoryMother } from '@modules/ledger/domain/category.mother';
import { ScheduledTransactionMother } from '@modules/ledger/domain/scheduled-transaction.mother';
import { TransactionMother } from '@modules/ledger/domain/transaction.mother';
import { migrateDatabase } from '@modules/storage/infrastructure';
import { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { SqliteCategoryRepository } from './sqlite-category.repository';
import { SqliteLedgerRepository } from './sqlite-ledger.repository';
import { SqliteScheduledTransactionRepository } from './sqlite-scheduled-transaction.repository';

describe('SqliteScheduledTransactionRepository', () => {
	let database: Database;
	let repository: SqliteScheduledTransactionRepository;
	let ledgerRepository: SqliteLedgerRepository;
	let categoryRepository: SqliteCategoryRepository;

	beforeEach(() => {
		database = new Database(':memory:');
		migrateDatabase(database);
		repository = new SqliteScheduledTransactionRepository(database);
		ledgerRepository = new SqliteLedgerRepository(database);
		categoryRepository = new SqliteCategoryRepository(database);
	});

	afterEach(() => database.close());

	it('round-trips a scheduled transaction', async () => {
		const schedule = ScheduledTransactionMother.create({
			categoryId: null,
			id: 'schedule-1',
			startDate: '2026-05-01',
		});
		await repository.save(schedule);

		expect(await repository.findById('schedule-1')).toEqual(schedule);
	});

	it('counts schedules by category', async () => {
		await categoryRepository.save(CategoryMother.create({ id: 'category-1' }));
		await repository.save(ScheduledTransactionMother.create({ categoryId: 'category-1', id: 'a' }));
		await repository.save(ScheduledTransactionMother.create({ categoryId: 'category-1', id: 'b' }));

		expect(await repository.countByCategory('category-1')).toBe(2);
		expect(await repository.countByCategory('missing')).toBe(0);
	});

	it('orders active schedules first, then paused and completed', async () => {
		await repository.save(
			ScheduledTransactionMother.create({ id: 'active-late', startDate: '2026-05-01' }).advance()
		);
		await repository.save(
			ScheduledTransactionMother.restore({
				id: 'active-early',
				nextDueDate: '2026-05-01',
				startDate: '2026-05-01',
			})
		);
		await repository.save(
			ScheduledTransactionMother.restore({
				id: 'paused',
				nextDueDate: '2026-04-01',
				startDate: '2026-04-01',
				status: 'paused',
			})
		);
		await repository.save(
			ScheduledTransactionMother.create({ frequency: 'once', id: 'completed', startDate: '2026-04-01' }).advance()
		);

		const page = await repository.search();

		expect(page.items.map(item => item.id)).toEqual(['active-early', 'active-late', 'paused', 'completed']);
	});

	it('filters by kind, status, posting mode, category and due date', async () => {
		await categoryRepository.save(CategoryMother.create({ id: 'category-1' }));
		await repository.save(
			ScheduledTransactionMother.create({ categoryId: 'category-1', id: 'automatic', kind: 'expense' })
		);
		await repository.save(
			ScheduledTransactionMother.create({
				categoryId: 'category-1',
				id: 'manual',
				kind: 'income',
				postingMode: 'manual',
			})
		);
		await repository.save(
			ScheduledTransactionMother.create({
				id: 'future',
				kind: 'income',
				postingMode: 'manual',
				startDate: '2026-12-01',
			})
		);

		const expenses = await repository.search({ kind: 'expense' });
		const manual = await repository.search({ postingMode: 'manual' });
		const categorized = await repository.search({ categoryId: 'category-1' });
		const due = await repository.search({ dueThrough: '2026-05-01' });

		expect(expenses.items.map(item => item.id)).toEqual(['automatic']);
		expect(manual.total).toBe(2);
		expect(categorized.total).toBe(2);
		expect(due.items.map(item => item.id)).toEqual(['automatic', 'manual']);
	});

	it('searches descriptions case-insensitively', async () => {
		await repository.save(ScheduledTransactionMother.create({ description: 'Alquiler', id: 'a' }));
		await repository.save(ScheduledTransactionMother.create({ description: 'Nómina', id: 'b' }));

		const page = await repository.search({ search: 'ALQUILER' });

		expect(page.items.map(item => item.id)).toEqual(['a']);
	});

	it('paginates while reporting the total', async () => {
		await repository.save(ScheduledTransactionMother.create({ id: 'a', startDate: '2026-05-01' }));
		await repository.save(ScheduledTransactionMother.create({ id: 'b', startDate: '2026-05-02' }));
		await repository.save(ScheduledTransactionMother.create({ id: 'c', startDate: '2026-05-03' }));

		const page = await repository.search({ limit: 1, offset: 1 });

		expect(page.total).toBe(3);
		expect(page.items.map(item => item.id)).toEqual(['b']);
	});

	it('finds only active automatic schedules due through today', async () => {
		await repository.save(ScheduledTransactionMother.create({ id: 'due', startDate: '2026-05-01' }));
		await repository.save(
			ScheduledTransactionMother.create({
				id: 'manual',
				postingMode: 'manual',
				startDate: '2026-05-01',
			})
		);
		await repository.save(ScheduledTransactionMother.create({ id: 'future', startDate: '2026-05-02' }));
		await repository.save(ScheduledTransactionMother.create({ id: 'paused', startDate: '2026-05-01' }).pause());

		const due = await repository.findDueAutomatic('2026-05-01');

		expect(due.map(item => item.id)).toEqual(['due']);
	});

	it('updates with optimistic versioning', async () => {
		const schedule = ScheduledTransactionMother.create({ id: 'a', startDate: '2026-05-01' });
		await repository.save(schedule);
		const updated = schedule.update({ amountMinor: 2000 }, '2026-05-01');

		expect(await repository.update(updated, schedule.version)).toBe(true);
		expect(await repository.update(updated, schedule.version)).toBe(false);
		expect(await repository.findById('a')).toMatchObject({ amountMinor: 2000, version: 1 });
	});

	it('posts an occurrence atomically and does not duplicate it', async () => {
		const schedule = ScheduledTransactionMother.create({ id: 'schedule-1', startDate: '2026-05-01' });
		await repository.save(schedule);
		const transaction = TransactionMother.create({ id: 'transaction-1', transactionDate: '2026-05-01' });
		const advanced = schedule.advance();

		const isPosted = await repository.savePostedOccurrence({
			expectedVersion: schedule.version,
			occurrenceNumber: schedule.occurrenceNumber,
			schedule: advanced,
			transaction,
		});
		const isDuplicate = await repository.savePostedOccurrence({
			expectedVersion: schedule.version,
			occurrenceNumber: schedule.occurrenceNumber,
			schedule: advanced,
			transaction: TransactionMother.create({ id: 'transaction-2' }),
		});

		expect(isPosted).toBe(true);
		expect(isDuplicate).toBe(false);
		expect(await ledgerRepository.findById('transaction-1')).toEqual(transaction);
		expect(await ledgerRepository.findById('transaction-2')).toBeUndefined();
		expect(await repository.findById('schedule-1')).toMatchObject({
			nextDueDate: '2026-06-01',
			occurrenceNumber: 1,
			version: 1,
		});
		expect(
			database
				.query<{ schedule_id: string; schedule_occurrence_number: number }, [string]>(
					'SELECT schedule_id, schedule_occurrence_number FROM transactions WHERE id = ?'
				)
				.get('transaction-1')
		).toEqual({ schedule_id: 'schedule-1', schedule_occurrence_number: 0 });
	});

	it('keeps posted transactions when the schedule is deleted', async () => {
		const schedule = ScheduledTransactionMother.create({ id: 'schedule-1', startDate: '2026-05-01' });
		await repository.save(schedule);
		const transaction = TransactionMother.create({ id: 'transaction-1', transactionDate: '2026-05-01' });
		await repository.savePostedOccurrence({
			expectedVersion: schedule.version,
			occurrenceNumber: schedule.occurrenceNumber,
			schedule: schedule.advance(),
			transaction,
		});

		expect(await repository.delete('schedule-1')).toBe(true);
		expect(await repository.delete('schedule-1')).toBe(false);
		expect(await repository.findById('schedule-1')).toBeUndefined();
		expect(await ledgerRepository.findById('transaction-1')).toEqual(transaction);
		expect(
			database
				.query<{ schedule_id: null | string }, [string]>('SELECT schedule_id FROM transactions WHERE id = ?')
				.get('transaction-1')
		).toEqual({ schedule_id: null });
	});

	it('prevents deleting a category that a schedule uses', async () => {
		await categoryRepository.save(CategoryMother.create({ id: 'category-1' }));
		await repository.save(ScheduledTransactionMother.create({ categoryId: 'category-1' }));

		let failure: unknown;
		try {
			await categoryRepository.delete('category-1');
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(Error);
		expect((failure as Error).message).toContain('FOREIGN KEY');
	});
});
