import {
	CategoryKindMismatchError,
	CategoryNotFoundError,
	ScheduledTransactionAmountInvalidError,
} from '@modules/ledger/domain';
import { CategoryMother } from '@modules/ledger/domain/category.mother';
import { MockCategoryRepository } from '@modules/ledger/infrastructure/repositories/mock-category.repository';
import { MockScheduledTransactionRepository } from '@modules/ledger/infrastructure/repositories/mock-scheduled-transaction.repository';
import { beforeEach, describe, expect, it } from 'bun:test';

import { CreateScheduledTransaction } from './create-scheduled-transaction';

describe('CreateScheduledTransaction', () => {
	let repository: MockScheduledTransactionRepository;
	let categoryRepository: MockCategoryRepository;
	let useCase: CreateScheduledTransaction;

	beforeEach(() => {
		repository = new MockScheduledTransactionRepository();
		categoryRepository = new MockCategoryRepository();
		useCase = new CreateScheduledTransaction(repository, categoryRepository, 'EUR');
	});

	it('saves an active schedule with the configured currency and actor', async () => {
		const schedule = await useCase.execute({
			actorId: 'user-1',
			amountMinor: 1250,
			description: 'Rent',
			frequency: 'monthly',
			kind: 'expense',
			startDate: '2026-05-01',
		});

		expect(schedule).toMatchObject({
			createdBy: 'user-1',
			currencyCode: 'EUR',
			description: 'Rent',
			interval: 1,
			nextDueDate: '2026-05-01',
			occurrenceNumber: 0,
			postingMode: 'automatic',
			status: 'active',
			version: 0,
		});
		expect(schedule.id).not.toBe('');
		repository.assertSaveHasBeenCalledWith(schedule);
	});

	it('assigns a category of the same kind', async () => {
		const category = CategoryMother.create({ id: 'category-1', kind: 'expense' });
		categoryRepository.shouldFind(category);

		const schedule = await useCase.execute({
			actorId: 'user-1',
			amountMinor: 1250,
			categoryId: 'category-1',
			frequency: 'monthly',
			kind: 'expense',
			startDate: '2026-05-01',
		});

		expect(schedule.categoryId).toBe('category-1');
	});

	it('normalizes a one-time schedule to a single occurrence', async () => {
		const schedule = await useCase.execute({
			actorId: null,
			amountMinor: 500,
			endDate: '2026-06-01',
			frequency: 'once',
			interval: 5,
			kind: 'income',
			startDate: '2026-05-01',
		});

		expect(schedule).toMatchObject({
			endDate: null,
			interval: 1,
			nextDueDate: '2026-05-01',
		});
	});

	it('rejects an unknown category', async () => {
		categoryRepository.shouldFind(undefined);

		let failure: unknown;
		try {
			await useCase.execute({
				actorId: 'user-1',
				amountMinor: 1250,
				categoryId: 'missing',
				frequency: 'monthly',
				kind: 'expense',
				startDate: '2026-05-01',
			});
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryNotFoundError);
		expect(repository.saved).toHaveLength(0);
	});

	it('rejects a category of another kind', async () => {
		categoryRepository.shouldFind(CategoryMother.create({ kind: 'income' }));

		let failure: unknown;
		try {
			await useCase.execute({
				actorId: 'user-1',
				amountMinor: 1250,
				categoryId: 'category-1',
				frequency: 'monthly',
				kind: 'expense',
				startDate: '2026-05-01',
			});
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryKindMismatchError);
		expect(repository.saved).toHaveLength(0);
	});

	it('rejects invalid amounts and currencies', async () => {
		let failure: unknown;
		try {
			await useCase.execute({
				actorId: 'user-1',
				amountMinor: 0,
				frequency: 'monthly',
				kind: 'expense',
				startDate: '2026-05-01',
			});
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(ScheduledTransactionAmountInvalidError);
		expect(() => new CreateScheduledTransaction(repository, categoryRepository, 'euro')).toThrow();
	});
});
