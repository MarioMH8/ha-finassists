import { CategoryNameInvalidError } from '@modules/ledger/domain';
import { CategoryMother } from '@modules/ledger/domain/category.mother';
import { MockCategoryRepository } from '@modules/ledger/infrastructure/repositories/mock-category.repository';
import { beforeEach, describe, expect, it } from 'bun:test';

import { CreateCategory } from './create-category';

describe('CreateCategory', () => {
	let repository: MockCategoryRepository;
	let useCase: CreateCategory;

	beforeEach(() => {
		repository = new MockCategoryRepository();
		useCase = new CreateCategory(repository);
	});

	it('saves a category', async () => {
		const category = await useCase.execute({ kind: 'expense', name: '  Groceries  ' });

		expect(category.name).toBe('Groceries');
		expect(category.kind).toBe('expense');
		expect(category.id).not.toBe('');
		repository.assertSaveHasBeenCalledWith(category);
	});

	it('rejects a duplicate name within the same kind', async () => {
		repository.shouldFindByName(CategoryMother.create({ name: 'Groceries' }));

		let failure: unknown;
		try {
			await useCase.execute({ kind: 'expense', name: 'Groceries' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(Error);
		expect((failure as Error).message).toContain('already exists');
		expect(repository.saved).toHaveLength(0);
	});

	it('allows the same name for a different kind', async () => {
		repository.shouldFindByName(undefined);

		const category = await useCase.execute({ kind: 'income', name: 'Other' });

		expect(category.kind).toBe('income');
	});

	it('does not save an invalid category', async () => {
		let failure: unknown;
		try {
			await useCase.execute({ kind: 'expense', name: ' '.repeat(3) });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryNameInvalidError);
		expect(repository.saved).toHaveLength(0);
	});
});
