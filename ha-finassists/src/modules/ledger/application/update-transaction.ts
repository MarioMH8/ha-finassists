import type { TransactionKind, TransactionRepository } from '../domain';
import { Transaction, TransactionNotFoundError } from '../domain';

interface UpdateTransactionInput {
	amountMinor?: number;
	description?: string;
	id: string;
	kind?: TransactionKind;
	transactionDate?: string;
}

export class UpdateTransaction {
	constructor(private readonly repository: TransactionRepository) {}

	async execute(input: UpdateTransactionInput): Promise<Transaction> {
		const existing = await this.repository.findById(input.id);
		if (existing === undefined) {
			throw new TransactionNotFoundError(input.id);
		}
		const transaction = Transaction.create({
			actorId: existing.actorId,
			amountMinor: input.amountMinor ?? existing.amountMinor,
			createdAt: existing.createdAt,
			currencyCode: existing.currencyCode,
			description: input.description ?? existing.description,
			id: existing.id,
			kind: input.kind ?? existing.kind,
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
