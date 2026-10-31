import type { ScheduledTransactionRepository } from '@modules/ledger/domain';
import { SCHEDULED_TRANSACTION_STATUS } from '@modules/ledger/domain';

const MAX_ACTIVE_SCHEDULES = 1000;

export class PauseActiveScheduledTransactions {
	constructor(private readonly repository: ScheduledTransactionRepository) {}

	async execute(): Promise<number> {
		const page = await this.repository.search({
			limit: MAX_ACTIVE_SCHEDULES,
			status: SCHEDULED_TRANSACTION_STATUS.ACTIVE,
		});
		let paused = 0;
		for (const schedule of page.items) {
			if (schedule.status !== SCHEDULED_TRANSACTION_STATUS.ACTIVE) {
				continue;
			}
			// Schedules share repository state and are paused sequentially.
			// eslint-disable-next-line no-await-in-loop
			const isUpdated = await this.repository.update(schedule.pause(), schedule.version);
			if (isUpdated) {
				paused += 1;
			}
		}

		return paused;
	}
}
