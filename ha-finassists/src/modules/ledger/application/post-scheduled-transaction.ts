import type { ScheduledTransaction, ScheduledTransactionRepository, Transaction } from '@modules/ledger/domain';
import { ScheduledTransactionVersionConflictError } from '@modules/ledger/domain';

import { createScheduledTransactionEntry } from './create-scheduled-transaction-entry';
import { requireScheduledTransaction } from './require-scheduled-transaction';

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
	constructor(private readonly repository: ScheduledTransactionRepository) {}

	async execute(input: PostScheduledTransactionInput): Promise<PostScheduledTransactionResult> {
		const schedule = await requireScheduledTransaction(this.repository, input.id);
		schedule.assertDue(input.today);
		const occurrenceNumber = schedule.occurrenceNumber;
		const transaction = createScheduledTransactionEntry(schedule, input.actorId, new Date().toISOString());
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
