import type { ScheduledPostingRepository, ScheduledTransaction, Transaction } from '@modules/ledger/domain';
import { ScheduledTransactionVersionConflictError } from '@modules/ledger/domain';

import { ScheduledTransactionGuard } from './guards/scheduled-transaction-guard';

interface PostScheduledTransactionInput {
	actorId: null | string;
	id: string;
	today: string;
}

interface PostScheduledTransactionResult {
	schedule: ScheduledTransaction;
	transaction: Transaction;
}

export class PostScheduledTransaction {
	constructor(private readonly repository: ScheduledPostingRepository) {}

	async execute(input: PostScheduledTransactionInput): Promise<PostScheduledTransactionResult> {
		const schedule = await ScheduledTransactionGuard.require(this.repository, input.id);
		schedule.assertDue(input.today);
		const occurrenceNumber = schedule.occurrenceNumber;
		const transaction = schedule.createEntry(input.actorId, new Date().toISOString(), crypto.randomUUID());
		const advanced = schedule.advance();
		const isSaved = await this.repository.savePostedOccurrence({
			expectedVersion: schedule.version,
			occurrenceNumber,
			schedule: advanced,
			transaction,
		});
		if (!isSaved) {
			throw new ScheduledTransactionVersionConflictError(schedule.id);
		}

		return { schedule: advanced, transaction };
	}
}

export type { PostScheduledTransactionInput, PostScheduledTransactionResult };
