import type { ScheduledTransaction } from '@modules/ledger/domain';
import { ScheduledTransactionNotDueError, Transaction } from '@modules/ledger/domain';

function createScheduledTransactionEntry(
	schedule: ScheduledTransaction,
	actorId: null | string,
	createdAt: string
): Transaction {
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

export { createScheduledTransactionEntry };
