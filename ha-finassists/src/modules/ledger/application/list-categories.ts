import type { CategoryCriteria, CategoryRepository, CategorySummary } from '../domain';

export class ListCategories {
	constructor(private readonly repository: CategoryRepository) {}

	async execute(criteria: CategoryCriteria = {}): Promise<CategorySummary[]> {
		return this.repository.search(criteria);
	}
}
