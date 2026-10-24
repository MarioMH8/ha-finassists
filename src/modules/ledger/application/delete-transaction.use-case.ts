import type { LedgerRepository } from '@modules/ledger/domain';

class DeleteTransaction {
	constructor(private readonly repository: LedgerRepository) {}

	execute(bookId: string, id: string): boolean {
		const transaction = this.repository.find(bookId, id);

		return transaction !== undefined && transaction.status !== 'reconciled' && this.repository.remove(bookId, id);
	}
}

export { DeleteTransaction };
