import { CategoryNotFoundError } from '@modules/ledger/domain';
import { CategoryMother } from '@modules/ledger/domain/category.mother';
import { MockCategoryRepository } from '@modules/ledger/infrastructure/repositories/mock-category.repository';
import { beforeEach, describe, expect, it } from 'bun:test';

import { requireCategory } from './require-category';

describe('requireCategory', () => {
	let repository: MockCategoryRepository;

	beforeEach(() => {
		repository = new MockCategoryRepository();
	});

	it('returns no category when the id is absent', async () => {
		const absent: null | undefined = null;

		expect(await requireCategory(repository, absent)).toBeUndefined();
	});

	it('returns the stored category', async () => {
		const category = CategoryMother.create();
		repository.shouldFind(category);

		expect(await requireCategory(repository, category.id)).toBe(category);
	});

	it('fails when the id does not exist', async () => {
		repository.shouldFind(undefined);

		let failure: unknown;
		try {
			await requireCategory(repository, 'missing');
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryNotFoundError);
	});
});
