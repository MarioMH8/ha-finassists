import type { TransactionCriteria, TransactionPage, TransactionRepository } from '@modules/ledger/domain';

export class ListTransactions {
	constructor(private readonly repository: TransactionRepository) {}

	async execute(criteria: TransactionCriteria = {}): Promise<TransactionPage> {
		return this.repository.search(criteria);
	}
}
