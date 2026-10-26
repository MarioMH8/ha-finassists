import type { CategoryKind, CategorySummary } from '@modules/ledger/domain';
import { Category } from '@modules/ledger/domain';

export interface CategoryRow {
	created_at: string;
	id: string;
	kind: CategoryKind;
	name: string;
	scheduled_transaction_count: number;
	transaction_count: number;
}

export class SqliteCategoryMapper {
	private constructor() {
		// Static-only mapper: instantiation is not part of the contract.
	}

	static toDomain(row: CategoryRow): Category {
		return Category.create({
			createdAt: row.created_at,
			id: row.id,
			kind: row.kind,
			name: row.name,
		});
	}

	static toSummary(row: CategoryRow): CategorySummary {
		return {
			category: this.toDomain(row),
			scheduledTransactionCount: row.scheduled_transaction_count,
			transactionCount: row.transaction_count,
		};
	}
}
