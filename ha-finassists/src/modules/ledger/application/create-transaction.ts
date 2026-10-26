import { Currency } from '@modules/money/domain';

import type { CategoryRepository, TransactionKind, TransactionRepository } from '../domain';
import { Transaction } from '../domain';
import { loadCategory } from './load-category';

interface CreateTransactionInput {
	actorId: null | string;
	amountMinor: number;
	categoryId?: null | string;
	description?: string;
	kind: TransactionKind;
	transactionDate: string;
}

export class CreateTransaction {
	private readonly currencyCode: string;

	constructor(
		private readonly repository: TransactionRepository,
		private readonly categoryRepository: CategoryRepository,
		currencyCode: string
	) {
		this.currencyCode = Currency.create(currencyCode).code;
	}

	async execute(input: CreateTransactionInput): Promise<Transaction> {
		const category = await loadCategory(this.categoryRepository, input.categoryId);
		category?.assertAccepts(input.kind);
		const transaction = Transaction.create({
			actorId: input.actorId,
			amountMinor: input.amountMinor,
			categoryId: category?.id,
			createdAt: new Date().toISOString(),
			currencyCode: this.currencyCode,
			description: input.description ?? '',
			id: crypto.randomUUID(),
			kind: input.kind,
			transactionDate: input.transactionDate,
		});
		await this.repository.save(transaction);

		return transaction;
	}
}

export type { CreateTransactionInput };
