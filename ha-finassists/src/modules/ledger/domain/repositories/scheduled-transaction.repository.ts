import type {
	ScheduledTransaction,
	ScheduledTransactionPostingMode,
	ScheduledTransactionStatus,
} from '@modules/ledger/domain/scheduled-transaction';
import type { TransactionKind } from '@modules/ledger/domain/transaction';

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

interface ScheduledTransactionRepository {
	delete(id: string): Promise<boolean>;
	findById(id: string): Promise<ScheduledTransaction | undefined>;
	save(schedule: ScheduledTransaction): Promise<void>;
	search(criteria?: ScheduledTransactionCriteria): Promise<ScheduledTransactionPage>;
	update(schedule: ScheduledTransaction, expectedVersion: number): Promise<boolean>;
}

export type { ScheduledTransactionCriteria, ScheduledTransactionPage, ScheduledTransactionRepository };
