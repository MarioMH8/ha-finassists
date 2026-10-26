import {
	CategoryKindMismatchError,
	CategoryNotFoundError,
	TransactionAmountInvalidError,
	TransactionNotFoundError,
} from '@modules/ledger/domain';
import { CategoryMother } from '@modules/ledger/domain/category.mother';
import { TransactionMother } from '@modules/ledger/domain/transaction.mother';
import { MockCategoryRepository } from '@modules/ledger/infrastructure/repositories/mock-category.repository';
import { MockLedgerRepository } from '@modules/ledger/infrastructure/repositories/mock-ledger.repository';
import { beforeEach, describe, expect, it } from 'bun:test';

import { UpdateTransaction } from './update-transaction';

describe('UpdateTransaction', () => {
	let repository: MockLedgerRepository;
	let categoryRepository: MockCategoryRepository;
	let useCase: UpdateTransaction;

	beforeEach(() => {
		repository = new MockLedgerRepository();
		categoryRepository = new MockCategoryRepository();
		useCase = new UpdateTransaction(repository, categoryRepository);
	});

	it('updates only the provided fields and keeps the rest', async () => {
		const existing = TransactionMother.create();
		repository.shouldFind(existing);
		repository.shouldUpdate(true);

		const updated = await useCase.execute({ amountMinor: 999, description: 'Dinner', id: existing.id });

		expect(updated).toMatchObject({
			actorId: existing.actorId,
			amountMinor: 999,
			categoryId: existing.categoryId,
			createdAt: existing.createdAt,
			currencyCode: existing.currencyCode,
			description: 'Dinner',
			id: existing.id,
			kind: existing.kind,
			transactionDate: existing.transactionDate,
		});
	});

	it('assigns and clears the category', async () => {
		const existing = TransactionMother.create();
		categoryRepository.shouldFind(CategoryMother.create({ id: 'category-1', kind: 'expense' }));
		repository.shouldFind(existing);
		repository.shouldUpdate(true);

		const categorized = await useCase.execute({ categoryId: 'category-1', id: existing.id });
		const cleared = await useCase.execute({ categoryId: null, id: existing.id });

		expect(categorized.categoryId).toBe('category-1');
		expect(cleared.categoryId).toBeNull();
	});

	it('rejects a category of another kind when the kind changes', async () => {
		const existing = TransactionMother.create({ categoryId: 'category-1', kind: 'expense' });
		categoryRepository.shouldFind(CategoryMother.create({ id: 'category-1', kind: 'expense' }));
		repository.shouldFind(existing);

		let failure: unknown;
		try {
			await useCase.execute({ id: existing.id, kind: 'income' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryKindMismatchError);
	});

	it('rejects an unknown category', async () => {
		repository.shouldFind(TransactionMother.create());
		categoryRepository.shouldFind(undefined);

		let failure: unknown;
		try {
			await useCase.execute({ categoryId: 'missing', id: 'transaction-1' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryNotFoundError);
	});

	it('fails when the transaction does not exist', async () => {
		repository.shouldFind(undefined);

		let failure: unknown;
		try {
			await useCase.execute({ amountMinor: 100, id: 'missing' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(TransactionNotFoundError);
	});

	it('rejects invalid values before updating', async () => {
		const existing = TransactionMother.create();
		repository.shouldFind(existing);

		let failure: unknown;
		try {
			await useCase.execute({ amountMinor: 0, id: existing.id });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(TransactionAmountInvalidError);
	});
});
