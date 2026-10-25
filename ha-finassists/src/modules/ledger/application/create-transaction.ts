import { Currency } from '@modules/money/domain';

import type { TransactionKind, TransactionRepository } from '../domain';
import { Transaction } from '../domain';

interface CreateTransactionInput {
	actorId: null | string;
	amountMinor: number;
	description?: string;
	kind: TransactionKind;
	transactionDate: string;
}

export class CreateTransaction {
	private readonly currencyCode: string;

	constructor(
		private readonly repository: TransactionRepository,
		currencyCode: string
	) {
		this.currencyCode = Currency.create(currencyCode).code;
	}

	async execute(input: CreateTransactionInput): Promise<Transaction> {
		const transaction = Transaction.create({
			actorId: input.actorId,
			amountMinor: input.amountMinor,
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
