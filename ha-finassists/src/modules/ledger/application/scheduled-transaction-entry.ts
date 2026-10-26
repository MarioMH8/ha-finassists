import type { ScheduledTransaction } from '@modules/ledger/domain';
import { ScheduledTransactionNotDueError, Transaction } from '@modules/ledger/domain';

class ScheduledTransactionEntry {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static create(schedule: ScheduledTransaction, actorId: null | string, createdAt: string): Transaction {
		if (schedule.nextDueDate === null) {
			throw new ScheduledTransactionNotDueError(schedule.id, null);
		}

		return Transaction.create({
			actorId,
			amountMinor: schedule.amountMinor,
			categoryId: schedule.categoryId,
			createdAt,
			currencyCode: schedule.currencyCode,
			description: schedule.description,
			id: crypto.randomUUID(),
			kind: schedule.kind,
			transactionDate: schedule.nextDueDate,
		});
	}
}

export { ScheduledTransactionEntry };
