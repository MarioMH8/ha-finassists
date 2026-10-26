import type { CategoryRepository } from '@modules/ledger/domain';
import { CategoryInUseError, CategoryNotFoundError } from '@modules/ledger/domain';

interface DeleteCategoryInput {
	id: string;
}

export class DeleteCategory {
	constructor(private readonly repository: CategoryRepository) {}

	async execute({ id }: DeleteCategoryInput): Promise<void> {
		const existing = await this.repository.findById(id);
		if (existing === undefined) {
			throw new CategoryNotFoundError(id);
		}
		const transactionCount = await this.repository.countTransactions(id);
		if (transactionCount > 0) {
			throw new CategoryInUseError(id, transactionCount);
		}
		const isDeleted = await this.repository.delete(id);
		if (!isDeleted) {
			throw new CategoryNotFoundError(id);
		}
	}
}

export type { DeleteCategoryInput };
