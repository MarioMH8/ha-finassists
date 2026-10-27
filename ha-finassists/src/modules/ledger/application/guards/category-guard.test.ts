import { CategoryNotFoundError } from '@modules/ledger/domain';
import { CategoryMother } from '@modules/ledger/domain/category.mother';
import { MockCategoryRepository } from '@modules/ledger/infrastructure/repositories/mock-category.repository';
import { beforeEach, describe, expect, it } from 'bun:test';

import { CategoryGuard } from './category-guard';

describe('CategoryGuard.require', () => {
	let repository: MockCategoryRepository;

	beforeEach(() => {
		repository = new MockCategoryRepository();
	});

	it('returns no category when the id is absent', async () => {
		const absent: null | undefined = null;

		expect(await CategoryGuard.require(repository, absent)).toBeUndefined();
	});

	it('returns the stored category', async () => {
		const category = CategoryMother.create();
		repository.shouldFind(category);

		expect(await CategoryGuard.require(repository, category.id)).toBe(category);
	});

	it('fails when the id does not exist', async () => {
		repository.shouldFind(undefined);

		let failure: unknown;
		try {
			await CategoryGuard.require(repository, 'missing');
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(CategoryNotFoundError);
	});
});
