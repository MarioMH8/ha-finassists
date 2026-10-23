import type { LedgerRepository, TransactionStatus } from '../domain';
import { TRANSACTION_STATUS } from '../domain';

const ALLOWED_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
	[TRANSACTION_STATUS.CLEARED]: [TRANSACTION_STATUS.UNCLEARED, TRANSACTION_STATUS.RECONCILED],
	[TRANSACTION_STATUS.RECONCILED]: [TRANSACTION_STATUS.CLEARED],
	[TRANSACTION_STATUS.UNCLEARED]: [TRANSACTION_STATUS.CLEARED, TRANSACTION_STATUS.RECONCILED],
};

class SetTransactionStatus {
	constructor(private readonly repository: LedgerRepository) {}

	execute(bookId: string, id: string, nextStatus: TransactionStatus): boolean {
		const existing = this.repository.find(bookId, id);
		if (!existing || !ALLOWED_TRANSITIONS[existing.status].includes(nextStatus)) {
			return false;
		}

		return this.repository.setStatus(bookId, id, nextStatus);
	}
}

export { SetTransactionStatus };
