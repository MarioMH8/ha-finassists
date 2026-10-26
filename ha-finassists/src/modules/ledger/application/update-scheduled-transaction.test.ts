import {
	CategoryKindMismatchError,
	ScheduledTransactionAmountInvalidError,
	ScheduledTransactionCompletedError,
	ScheduledTransactionNotFoundError,
	ScheduledTransactionVersionConflictError,
} from '@modules/ledger/domain';
import { CategoryMother } from '@modules/ledger/domain/category.mother';
import { ScheduledTransactionMother } from '@modules/ledger/domain/scheduled-transaction.mother';
import { MockCategoryRepository } from '@modules/ledger/infrastructure/repositories/mock-category.repository';
import { MockScheduledTransactionRepository } from '@modules/ledger/infrastructure/repositories/mock-scheduled-transaction.repository';
import { beforeEach, describe, expect, it } from 'bun:test';

import { UpdateScheduledTransaction } from './update-scheduled-transaction';

const TODAY = '2026-06-20';

describe('UpdateScheduledTransaction', () => {
	let repository: MockScheduledTransactionRepository;
	let categoryRepository: MockCategoryRepository;
	let useCase: UpdateScheduledTransaction;

	beforeEach(() => {
		repository = new MockScheduledTransactionRepository();
		categoryRepository = new MockCategoryRepository();
		useCase = new UpdateScheduledTransaction(repository, categoryRepository);
	});

	it('updates only the provided fields and keeps the next occurrence', async () => {
		const existing = ScheduledTransactionMother.create({ startDate: '2026-01-31' });
		repository.shouldFind(existing);
		repository.shouldUpdate(true);

		const updated = await useCase.execute({
			amountMinor: 999,
			description: 'Updated',
			id: existing.id,
			today: TODAY,
		});

		expect(updated).toMatchObject({
			amountMinor: 999,
			description: 'Updated',
			nextDueDate: '2026-01-31',
			occurrenceNumber: 0,
			version: existing.version + 1,
		});
		expect(repository.updated).toEqual([updated]);
	});

	it('recalculates the next occurrence when recurrence changes', async () => {
		const existing = ScheduledTransactionMother.create({ startDate: '2026-01-31' });
		repository.shouldFind(existing);
		repository.shouldUpdate(true);

		const updated = await useCase.execute({
			id: existing.id,
			startDate: '2026-02-15',
			today: TODAY,
		});

		expect(updated).toMatchObject({
			nextDueDate: '2026-07-15',
			occurrenceNumber: 5,
			version: existing.version + 1,
		});
	});

	it('pauses and resumes a schedule', async () => {
		const existing = ScheduledTransactionMother.create({ startDate: '2026-01-31' });
		repository.shouldFind(existing);
		repository.shouldUpdate(true);
		const paused = await useCase.execute({ id: existing.id, status: 'paused', today: '2026-02-01' });

		expect(paused).toMatchObject({
			nextDueDate: '2026-01-31',
			status: 'paused',
			version: existing.version + 1,
		});

		repository.shouldFind(paused);
		const resumed = await useCase.execute({ id: existing.id, status: 'active', today: '2026-03-15' });

		expect(resumed).toMatchObject({
			nextDueDate: '2026-03-31',
			occurrenceNumber: 2,
			status: 'active',
			version: paused.version + 1,
		});
	});

	it('clears and assigns a category', async () => {
		const existing = ScheduledTransactionMother.create({ categoryId: 'category-1' });
		repository.shouldFind(existing);
		repository.shouldUpdate(true);
		const cleared = await useCase.execute({ categoryId: null, id: existing.id, today: TODAY });

		expect(cleared.categoryId).toBeNull();

		categoryRepository.shouldFind(CategoryMother.create({ id: 'category-2', kind: 'expense' }));
		repository.shouldFind(existing);
		const assigned = await useCase.execute({
			categoryId: 'category-2',
			id: existing.id,
			today: TODAY,
		});

		expect(assigned.categoryId).toBe('category-2');
	});

	it('rejects changes to a completed schedule', async () => {
		const completed = ScheduledTransactionMother.create({
			frequency: 'once',
			startDate: '2026-05-01',
		}).advance();
		repository.shouldFind(completed);

		let failure: unknown;
		try {
			await useCase.execute({ amountMinor: 100, id: completed.id, today: TODAY });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(ScheduledTransactionCompletedError);
	});

	it('rejects a category of another kind when the kind changes', async () => {
		const existing = ScheduledTransactionMother.create({ categoryId: 'category-1', kind: 'expense' });
		repository.shouldFind(existing);
		categoryRepository.shouldFind(CategoryMother.create({ id: 'category-1', kind: 'expense' }));

		let failure: unknown;
		try {
			await useCase.execute({ id: existing.id, kind: 'income', today: TODAY });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryKindMismatchError);
	});

	it('rejects a stale version', async () => {
		const existing = ScheduledTransactionMother.create();
		repository.shouldFind(existing);
		repository.shouldUpdate(false);

		let failure: unknown;
		try {
			await useCase.execute({ amountMinor: 100, id: existing.id, today: TODAY });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(ScheduledTransactionVersionConflictError);
	});

	it('fails when the schedule does not exist', async () => {
		repository.shouldFind(undefined);

		let failure: unknown;
		try {
			await useCase.execute({ amountMinor: 100, id: 'missing', today: TODAY });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(ScheduledTransactionNotFoundError);
	});

	it('rejects invalid values before updating', async () => {
		const existing = ScheduledTransactionMother.create();
		repository.shouldFind(existing);

		let failure: unknown;
		try {
			await useCase.execute({ amountMinor: 0, id: existing.id, today: TODAY });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(ScheduledTransactionAmountInvalidError);
	});
});
