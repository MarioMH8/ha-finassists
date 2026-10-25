import type { TransactionRepository } from '../domain';

interface DeleteTransactionsInput {
	ids: string[];
}

export class DeleteTransactions {
	constructor(private readonly repository: TransactionRepository) {}

	async execute({ ids }: DeleteTransactionsInput): Promise<number> {
		return this.repository.deleteMany([...new Set(ids)]);
	}
}

export type { DeleteTransactionsInput };
