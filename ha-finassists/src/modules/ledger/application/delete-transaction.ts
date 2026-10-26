import type { TransactionRepository } from '@modules/ledger/domain';
import { TransactionNotFoundError } from '@modules/ledger/domain';

interface DeleteTransactionInput {
	id: string;
}

export class DeleteTransaction {
	constructor(private readonly repository: TransactionRepository) {}

	async execute(input: DeleteTransactionInput): Promise<void> {
		const isDeleted = await this.repository.delete({ id: input.id });
		if (!isDeleted) {
			throw new TransactionNotFoundError(input.id);
		}
	}
}

export type { DeleteTransactionInput };
