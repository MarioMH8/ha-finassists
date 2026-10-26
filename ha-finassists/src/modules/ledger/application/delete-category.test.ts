import { CategoryInUseError, CategoryNotFoundError } from '@modules/ledger/domain';
import { CategoryMother } from '@modules/ledger/domain/category.mother';
import { MockCategoryRepository } from '@modules/ledger/infrastructure/repositories/mock-category.repository';
import { beforeEach, describe, expect, it } from 'bun:test';

import { DeleteCategory } from './delete-category';

describe('DeleteCategory', () => {
	let repository: MockCategoryRepository;
	let useCase: DeleteCategory;

	beforeEach(() => {
		repository = new MockCategoryRepository();
		useCase = new DeleteCategory(repository);
	});

	it('deletes a category without movements', async () => {
		repository.shouldFind(CategoryMother.create());
		repository.shouldCountTransactions(0);
		repository.shouldDelete(true);

		await useCase.execute({ id: 'category-1' });

		repository.assertDeleteHasBeenCalledWith('category-1');
	});

	it('refuses to delete a category in use', async () => {
		repository.shouldFind(CategoryMother.create());
		repository.shouldCountTransactions(7);

		let failure: unknown;
		try {
			await useCase.execute({ id: 'category-1' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryInUseError);
		expect((failure as Error).message).toContain('7 movements');
	});

	it('refuses to delete a category used only by scheduled transactions', async () => {
		repository.shouldFind(CategoryMother.create());
		repository.shouldCountTransactions(0);
		repository.shouldCountScheduledTransactions(2);

		let failure: unknown;
		try {
			await useCase.execute({ id: 'category-1' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryInUseError);
		expect((failure as Error).message).toContain('2 movements');
	});

	it('fails when the category does not exist', async () => {
		repository.shouldFind(undefined);

		let failure: unknown;
		try {
			await useCase.execute({ id: 'missing' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryNotFoundError);
	});
});
