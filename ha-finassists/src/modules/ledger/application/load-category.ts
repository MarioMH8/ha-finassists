import type { Category, CategoryRepository } from '@modules/ledger/domain';
import { CategoryNotFoundError } from '@modules/ledger/domain';

async function loadCategory(
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

export { loadCategory };
