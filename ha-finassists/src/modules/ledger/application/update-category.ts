import type { CategoryKind, CategoryRepository } from '@modules/ledger/domain';
import {
	Category,
	CategoryInUseError,
	CategoryNameAlreadyExistsError,
	CategoryNotFoundError,
} from '@modules/ledger/domain';

import { CategoryGuard } from './guards/category-guard';

interface UpdateCategoryInput {
	id: string;
	kind?: CategoryKind;
	name?: string;
}

export class UpdateCategory {
	constructor(private readonly repository: CategoryRepository) {}

	async execute(input: UpdateCategoryInput): Promise<Category> {
		const existing = await CategoryGuard.require(this.repository, input.id);
		const category = Category.create({
			createdAt: existing.createdAt,
			id: existing.id,
			kind: input.kind ?? existing.kind,
			name: input.name ?? existing.name,
		});
		if (category.kind !== existing.kind) {
			const [transactionCount, scheduledTransactionCount] = await Promise.all([
				this.repository.countTransactions(category.id),
				this.repository.countScheduledTransactions(category.id),
			]);
			const movementCount = transactionCount + scheduledTransactionCount;
			if (movementCount > 0) {
				throw new CategoryInUseError(category.id, movementCount);
			}
		}
		const duplicate = await this.repository.findByName(category.kind, category.name);
		if (duplicate !== undefined && duplicate.id !== category.id) {
			throw new CategoryNameAlreadyExistsError(category.name);
		}
		const isUpdated = await this.repository.update(category);
		if (!isUpdated) {
			throw new CategoryNotFoundError(input.id);
		}

		return category;
	}
}

export type { UpdateCategoryInput };
