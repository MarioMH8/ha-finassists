import type { Category, CategoryRepository } from '@modules/ledger/domain';
import { CategoryNotFoundError } from '@modules/ledger/domain';

/*
 * An absent id means "no category", which is valid. An id that does not exist is
 * an error: callers pass `null` to clear a category and `undefined` to keep it,
 * and both represent the absence, so the distinction lives here.
 */
class CategoryGuard {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static require(repository: CategoryRepository, categoryId: string): Promise<Category>;
	static require(
		repository: CategoryRepository,
		categoryId: null | string | undefined
	): Promise<Category | undefined>;
	static async require(
		repository: CategoryRepository,
		categoryId: null | string | undefined
	): Promise<Category | undefined> {
		if (categoryId === undefined || categoryId === null) {
			return undefined;
		}
		const category = await repository.findById(categoryId);
		if (category === undefined) {
			throw new CategoryNotFoundError(categoryId);
		}

		return category;
	}
}

export { CategoryGuard };
