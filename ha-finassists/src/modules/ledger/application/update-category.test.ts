import { CategoryInUseError, CategoryNameAlreadyExistsError, CategoryNotFoundError } from '@modules/ledger/domain';
import { CategoryMother } from '@modules/ledger/domain/category.mother';
import { MockCategoryRepository } from '@modules/ledger/infrastructure/repositories/mock-category.repository';
import { beforeEach, describe, expect, it } from 'bun:test';

import { UpdateCategory } from './update-category';

describe('UpdateCategory', () => {
	let repository: MockCategoryRepository;
	let useCase: UpdateCategory;

	beforeEach(() => {
		repository = new MockCategoryRepository();
		useCase = new UpdateCategory(repository);
	});

	it('renames a category and keeps the rest', async () => {
		const existing = CategoryMother.create();
		repository.shouldFind(existing);
		repository.shouldFindByName(undefined);
		repository.shouldUpdate(true);

		const updated = await useCase.execute({ id: existing.id, name: 'Food' });

		expect(updated).toMatchObject({
			createdAt: existing.createdAt,
			id: existing.id,
			kind: existing.kind,
			name: 'Food',
		});
	});

	it('rejects a name that another category already uses', async () => {
		const existing = CategoryMother.create();
		repository.shouldFind(existing);
		repository.shouldFindByName(CategoryMother.create({ id: 'category-2', name: 'Food' }));

		let failure: unknown;
		try {
			await useCase.execute({ id: existing.id, name: 'Food' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryNameAlreadyExistsError);
	});

	it('rejects changing the kind of a category in use', async () => {
		const existing = CategoryMother.create();
		repository.shouldFind(existing);
		repository.shouldCountTransactions(4);

		let failure: unknown;
		try {
			await useCase.execute({ id: existing.id, kind: 'income' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryInUseError);
	});

	it('rejects changing the kind of a category used by a scheduled transaction', async () => {
		const existing = CategoryMother.create();
		repository.shouldFind(existing);
		repository.shouldCountTransactions(0);
		repository.shouldCountScheduledTransactions(1);

		let failure: unknown;
		try {
			await useCase.execute({ id: existing.id, kind: 'income' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryInUseError);
	});

	it('changes the kind of an unused category', async () => {
		const existing = CategoryMother.create();
		repository.shouldFind(existing);
		repository.shouldCountTransactions(0);
		repository.shouldFindByName(undefined);
		repository.shouldUpdate(true);

		const updated = await useCase.execute({ id: existing.id, kind: 'income' });

		expect(updated.kind).toBe('income');
	});

	it('fails when the category does not exist', async () => {
		repository.shouldFind(undefined);

		let failure: unknown;
		try {
			await useCase.execute({ id: 'missing', name: 'Food' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryNotFoundError);
	});
});
