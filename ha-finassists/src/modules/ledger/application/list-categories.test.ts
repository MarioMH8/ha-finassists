import { describe, expect, it } from 'bun:test';

import { CategoryMother } from '../domain/category.mother';
import { MockCategoryRepository } from '../infrastructure/repositories/mock-category.repository';
import { ListCategories } from './list-categories';

describe('ListCategories', () => {
	it('delegates the criteria to the repository', async () => {
		const repository = new MockCategoryRepository();
		const summary = { category: CategoryMother.create(), transactionCount: 3 };
		repository.shouldSearch([summary]);

		const categories = await new ListCategories(repository).execute({ kind: 'expense' });

		expect(categories).toEqual([summary]);
	});

	it('lists every category when no criteria is given', async () => {
		const repository = new MockCategoryRepository();
		repository.shouldSearch([]);

		expect(await new ListCategories(repository).execute()).toEqual([]);
	});
});
