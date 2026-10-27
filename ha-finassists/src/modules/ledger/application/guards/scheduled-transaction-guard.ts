import type { ScheduledTransaction } from '@modules/ledger/domain';
import { ScheduledTransactionNotFoundError } from '@modules/ledger/domain';

interface ScheduledTransactionReader {
	findById(id: string): Promise<ScheduledTransaction | undefined>;
}

class ScheduledTransactionGuard {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static async require(repository: ScheduledTransactionReader, id: string): Promise<ScheduledTransaction> {
		const schedule = await repository.findById(id);
		if (schedule === undefined) {
			throw new ScheduledTransactionNotFoundError(id);
		}

		return schedule;
	}
}

export { ScheduledTransactionGuard, type ScheduledTransactionReader };
