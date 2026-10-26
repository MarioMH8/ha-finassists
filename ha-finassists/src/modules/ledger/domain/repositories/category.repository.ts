import type { Category, CategoryKind } from '@modules/ledger/domain/category';

interface CategoryCriteria {
	kind?: CategoryKind;
}

interface CategorySummary {
	category: Category;
	scheduledTransactionCount: number;
	transactionCount: number;
}

interface CategoryRepository {
	countScheduledTransactions(id: string): Promise<number>;
	countTransactions(id: string): Promise<number>;
	delete(id: string): Promise<boolean>;
	findById(id: string): Promise<Category | undefined>;
	findByName(kind: CategoryKind, name: string): Promise<Category | undefined>;
	save(category: Category): Promise<void>;
	search(criteria?: CategoryCriteria): Promise<CategorySummary[]>;
	update(category: Category): Promise<boolean>;
}

export type { CategoryCriteria, CategoryRepository, CategorySummary };
