import type { LedgerRepository } from '@modules/ledger/domain';

class ListTransactions {
	constructor(private readonly repository: LedgerRepository) {}

	execute(bookId: string, accountId: string): ReturnType<LedgerRepository['list']> {
		return this.repository.list(bookId, accountId);
	}
}

export { ListTransactions };
