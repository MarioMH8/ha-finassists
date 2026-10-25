import { beforeEach, describe, expect, it } from 'bun:test';

import { TransactionAmountInvalidError } from '../domain';
import { CategoryMother } from '../domain/category.mother';
import { MockCategoryRepository } from '../infrastructure/repositories/mock-category.repository';
import { MockLedgerRepository } from '../infrastructure/repositories/mock-ledger.repository';
import { CreateTransaction } from './create-transaction';

describe('CreateTransaction', () => {
	let repository: MockLedgerRepository;
	let categoryRepository: MockCategoryRepository;
	let useCase: CreateTransaction;

	beforeEach(() => {
		repository = new MockLedgerRepository();
		categoryRepository = new MockCategoryRepository();
		useCase = new CreateTransaction(repository, categoryRepository, 'EUR');
	});

	it('saves the transaction with the configured currency and actor', async () => {
		const transaction = await useCase.execute({
			actorId: 'user-1',
			amountMinor: 1250,
			description: 'Groceries',
			kind: 'expense',
			transactionDate: '2026-05-15',
		});

		expect(transaction.currencyCode).toBe('EUR');
		expect(transaction.actorId).toBe('user-1');
		expect(transaction.description).toBe('Groceries');
		expect(transaction.categoryId).toBeNull();
		expect(transaction.id).not.toBe('');
		repository.assertSaveHasBeenCalledWith(transaction);
	});

	it('defaults the description to an empty string', async () => {
		const transaction = await useCase.execute({
			actorId: null,
			amountMinor: 500,
			kind: 'income',
			transactionDate: '2026-05-01',
		});

		expect(transaction.description).toBe('');
		expect(transaction.actorId).toBeNull();
	});

	it('assigns a category of the same kind', async () => {
		const category = CategoryMother.create({ id: 'category-1', kind: 'expense' });
		categoryRepository.shouldFind(category);

		const transaction = await useCase.execute({
			actorId: 'user-1',
			amountMinor: 1250,
			categoryId: 'category-1',
			kind: 'expense',
			transactionDate: '2026-05-15',
		});

		expect(transaction.categoryId).toBe('category-1');
	});

	it('rejects an unknown category', async () => {
		categoryRepository.shouldFind(undefined);

		let failure: unknown;
		try {
			await useCase.execute({
				actorId: 'user-1',
				amountMinor: 1250,
				categoryId: 'missing',
				kind: 'expense',
				transactionDate: '2026-05-15',
			});
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(Error);
		expect((failure as Error).message).toContain('not found');
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
				kind: 'expense',
				transactionDate: '2026-05-15',
			});
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(Error);
		expect((failure as Error).message).toContain('must match');
		expect(repository.saved).toHaveLength(0);
	});

	it('does not save an invalid transaction', async () => {
		let failure: unknown;
		try {
			await useCase.execute({
				actorId: 'user-1',
				amountMinor: 0,
				kind: 'expense',
				transactionDate: '2026-05-15',
			});
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(TransactionAmountInvalidError);
		expect(repository.saved).toHaveLength(0);
	});

	it('rejects an unsupported currency', () => {
		expect(() => new CreateTransaction(repository, categoryRepository, 'euro')).toThrow();
	});
});
