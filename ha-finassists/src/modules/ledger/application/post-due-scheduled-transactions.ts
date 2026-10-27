import type { ScheduledPostingRepository, ScheduledTransaction } from '@modules/ledger/domain';
import { SCHEDULED_TRANSACTION_POSTING_MODE, SCHEDULED_TRANSACTION_STATUS } from '@modules/ledger/domain';

const MAX_DUE_SCHEDULES = 1000;

interface PostDueScheduledTransactionsResult {
	posted: number;
	schedules: number;
}

export class PostDueScheduledTransactions {
	constructor(
		private readonly repository: ScheduledPostingRepository,
		private readonly today: () => string,
		private readonly now: () => string,
		private readonly maxOccurrencesPerSchedule = 100
	) {}

	async execute(): Promise<PostDueScheduledTransactionsResult> {
		const today = this.today();
		const page = await this.repository.search({
			dueThrough: today,
			limit: MAX_DUE_SCHEDULES,
			postingMode: SCHEDULED_TRANSACTION_POSTING_MODE.AUTOMATIC,
			status: SCHEDULED_TRANSACTION_STATUS.ACTIVE,
		});
		const dueSchedules = page.items;
		let posted = 0;
		for (const schedule of dueSchedules) {
			// Schedules share the repository and optimistic versions, so posting stays sequential.
			// eslint-disable-next-line no-await-in-loop
			posted += await this.postSchedule(schedule, today);
		}

		return { posted, schedules: dueSchedules.length };
	}

	private async postSchedule(schedule: ScheduledTransaction, today: string): Promise<number> {
		let current = schedule;
		let posted = 0;
		while (current.isDue(today) && posted < this.maxOccurrencesPerSchedule) {
			const occurrenceNumber = current.occurrenceNumber;
			const transaction = current.createEntry(current.createdBy, this.now(), crypto.randomUUID());
			const advanced = current.advance();
			// The version check must complete before the next occurrence uses the new version.
			// eslint-disable-next-line no-await-in-loop
			const isSaved = await this.repository.savePostedOccurrence({
				expectedVersion: current.version,
				occurrenceNumber,
				schedule: advanced,
				transaction,
			});
			if (!isSaved) {
				break;
			}
			posted += 1;
			current = advanced;
		}

		return posted;
	}
}

export type { PostDueScheduledTransactionsResult };
