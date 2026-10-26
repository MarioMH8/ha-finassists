import type {
	ScheduledTransactionCriteria,
	ScheduledTransactionPage,
	ScheduledTransactionRepository,
} from '@modules/ledger/domain';

export class ListScheduledTransactions {
	constructor(private readonly repository: ScheduledTransactionRepository) {}

	async execute(criteria: ScheduledTransactionCriteria = {}): Promise<ScheduledTransactionPage> {
		return this.repository.search(criteria);
	}
}
