import type { ScheduledTransaction, ScheduledTransactionRepository } from '@modules/ledger/domain';
import { ScheduledTransactionVersionConflictError } from '@modules/ledger/domain';

import { ScheduledTransactionGuard } from './guards/scheduled-transaction-guard';

interface SkipScheduledTransactionInput {
	id: string;
	today: string;
}

export class SkipScheduledTransaction {
	constructor(private readonly repository: ScheduledTransactionRepository) {}

	async execute(input: SkipScheduledTransactionInput): Promise<ScheduledTransaction> {
		const schedule = await ScheduledTransactionGuard.require(this.repository, input.id);
		schedule.assertDue(input.today);
		const advanced = schedule.advance();
		const isUpdated = await this.repository.update(advanced, schedule.version);
		if (!isUpdated) {
			throw new ScheduledTransactionVersionConflictError(schedule.id);
		}

		return advanced;
	}
}

export type { SkipScheduledTransactionInput };
