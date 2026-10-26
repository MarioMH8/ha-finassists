import type { CategoryRepository, TransactionKind, TransactionRepository } from '@modules/ledger/domain';
import { Transaction, TransactionNotFoundError } from '@modules/ledger/domain';

import { loadCategory } from './load-category';

interface UpdateTransactionInput {
	amountMinor?: number;
	categoryId?: null | string;
	description?: string;
	id: string;
	kind?: TransactionKind;
	transactionDate?: string;
}

export class UpdateTransaction {
	constructor(
		private readonly repository: TransactionRepository,
		private readonly categoryRepository: CategoryRepository
	) {}

	async execute(input: UpdateTransactionInput): Promise<Transaction> {
		const existing = await this.repository.findById(input.id);
		if (existing === undefined) {
			throw new TransactionNotFoundError(input.id);
		}
		const kind = input.kind ?? existing.kind;
		const requestedCategoryId = 'categoryId' in input ? input.categoryId : existing.categoryId;
		const category = await loadCategory(this.categoryRepository, requestedCategoryId);
		category?.assertAccepts(kind);
		const transaction = Transaction.create({
			actorId: existing.actorId,
			amountMinor: input.amountMinor ?? existing.amountMinor,
			categoryId: category?.id,
			createdAt: existing.createdAt,
			currencyCode: existing.currencyCode,
			description: input.description ?? existing.description,
			id: existing.id,
			kind,
			transactionDate: input.transactionDate ?? existing.transactionDate,
		});
		const isUpdated = await this.repository.update(transaction);
		if (!isUpdated) {
			throw new TransactionNotFoundError(input.id);
		}

		return transaction;
	}
}

export type { UpdateTransactionInput };
