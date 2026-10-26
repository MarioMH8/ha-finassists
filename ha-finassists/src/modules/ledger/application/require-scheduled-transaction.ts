import type { ScheduledTransaction, ScheduledTransactionRepository } from '@modules/ledger/domain';
import { ScheduledTransactionNotFoundError } from '@modules/ledger/domain';

async function requireScheduledTransaction(
	repository: ScheduledTransactionRepository,
	id: string
): Promise<ScheduledTransaction> {
	const schedule = await repository.findById(id);
	if (schedule === undefined) {
		throw new ScheduledTransactionNotFoundError(id);
	}

	return schedule;
}

export { requireScheduledTransaction };
