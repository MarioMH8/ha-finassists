import type { LedgerRepository, UpdateTransactionInput } from '@modules/ledger/domain';

class UpdateTransaction {
	constructor(private readonly repository: LedgerRepository) {}

	execute(bookId: string, id: string, input: UpdateTransactionInput): ReturnType<LedgerRepository['update']> {
		const existing = this.repository.find(bookId, id);
		if (!existing) {
			return;
		}

		return this.repository.update(bookId, id, existing.update(input));
	}
}

export { UpdateTransaction };
