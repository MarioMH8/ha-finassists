import type {
	ScheduledTransaction,
	ScheduledTransactionPostingMode,
	ScheduledTransactionStatus,
} from '@modules/ledger/domain/scheduled-transaction';
import type { Transaction, TransactionKind } from '@modules/ledger/domain/transaction';

interface ScheduledTransactionCriteria {
	categoryId?: string;
	dueThrough?: string;
	kind?: TransactionKind;
	limit?: number;
	offset?: number;
	postingMode?: ScheduledTransactionPostingMode;
	search?: string;
	status?: ScheduledTransactionStatus;
}

interface ScheduledTransactionPage {
	items: ScheduledTransaction[];
	total: number;
}

interface ScheduledOccurrencePosting {
	expectedVersion: number;
	occurrenceNumber: number;
	schedule: ScheduledTransaction;
	transaction: Transaction;
}

interface ScheduledTransactionRepository {
	countByCategory(id: string): Promise<number>;
	delete(id: string): Promise<boolean>;
	findById(id: string): Promise<ScheduledTransaction | undefined>;
	findDueAutomatic(today: string, limit?: number): Promise<ScheduledTransaction[]>;
	save(schedule: ScheduledTransaction): Promise<void>;
	savePostedOccurrence(posting: ScheduledOccurrencePosting): Promise<boolean>;
	search(criteria?: ScheduledTransactionCriteria): Promise<ScheduledTransactionPage>;
	update(schedule: ScheduledTransaction, expectedVersion: number): Promise<boolean>;
}

export type {
	ScheduledOccurrencePosting,
	ScheduledTransactionCriteria,
	ScheduledTransactionPage,
	ScheduledTransactionRepository,
};
