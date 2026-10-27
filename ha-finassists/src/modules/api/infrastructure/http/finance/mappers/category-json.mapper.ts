import type { Category, CategorySummary } from '@modules/ledger/domain';

interface CategoryJson {
	createdAt: string;
	id: string;
	kind: string;
	name: string;
}

interface CategorySummaryJson extends CategoryJson {
	scheduledTransactionCount: number;
	transactionCount: number;
}

class CategoryJsonMapper {
	private constructor() {}

	static toJson(category: Category): CategoryJson {
		return {
			createdAt: category.createdAt,
			id: category.id,
			kind: category.kind,
			name: category.name,
		};
	}

	static toSummary({ category, scheduledTransactionCount, transactionCount }: CategorySummary): CategorySummaryJson {
		return { ...this.toJson(category), scheduledTransactionCount, transactionCount };
	}
}

export { CategoryJsonMapper };
