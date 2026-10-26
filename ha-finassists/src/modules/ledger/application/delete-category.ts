import type { CategoryRepository } from '@modules/ledger/domain';
import { CategoryInUseError, CategoryNotFoundError } from '@modules/ledger/domain';

import { requireCategory } from './require-category';

interface DeleteCategoryInput {
	id: string;
}

export class DeleteCategory {
	constructor(private readonly repository: CategoryRepository) {}

	async execute({ id }: DeleteCategoryInput): Promise<void> {
		await requireCategory(this.repository, id);
		const [transactionCount, scheduledTransactionCount] = await Promise.all([
			this.repository.countTransactions(id),
			this.repository.countScheduledTransactions(id),
		]);
		const movementCount = transactionCount + scheduledTransactionCount;
		if (movementCount > 0) {
			throw new CategoryInUseError(id, movementCount);
		}
		const isDeleted = await this.repository.delete(id);
		if (!isDeleted) {
			throw new CategoryNotFoundError(id);
		}
	}
}

export type { DeleteCategoryInput };
