import type { Category, CategoryRepository } from '@modules/ledger/domain';
import { CategoryNotFoundError } from '@modules/ledger/domain';

/*
 * An absent id means "no category", which is valid. An id that does not exist is
 * an error: callers pass `null` to clear a category and `undefined` to keep it,
 * and both represent the absence, so the distinction lives here.
 */
function requireCategory(repository: CategoryRepository, categoryId: string): Promise<Category>;
function requireCategory(
	repository: CategoryRepository,
	categoryId: null | string | undefined
): Promise<Category | undefined>;
async function requireCategory(
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

export { requireCategory };
