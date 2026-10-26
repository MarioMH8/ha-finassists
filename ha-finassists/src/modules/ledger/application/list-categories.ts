import type { CategoryCriteria, CategoryRepository, CategorySummary } from '@modules/ledger/domain';

export class ListCategories {
	constructor(private readonly repository: CategoryRepository) {}

	async execute(criteria: CategoryCriteria = {}): Promise<CategorySummary[]> {
		return this.repository.search(criteria);
	}
}
