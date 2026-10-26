import type { ScheduledTransaction } from '@modules/ledger/domain/scheduled-transaction';
import type { Transaction } from '@modules/ledger/domain/transaction';

import type { ScheduledTransactionCriteria, ScheduledTransactionPage } from './scheduled-transaction.repository';

interface ScheduledOccurrencePosting {
	expectedVersion: number;
	occurrenceNumber: number;
	schedule: ScheduledTransaction;
	transaction: Transaction;
}

interface ScheduledPostingRepository {
	findById(id: string): Promise<ScheduledTransaction | undefined>;
	savePostedOccurrence(posting: ScheduledOccurrencePosting): Promise<boolean>;
	search(criteria?: ScheduledTransactionCriteria): Promise<ScheduledTransactionPage>;
}

export type { ScheduledOccurrencePosting, ScheduledPostingRepository };
