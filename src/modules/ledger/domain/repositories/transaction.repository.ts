import type { Transaction, TransactionKind } from '../transaction';

interface TransactionCriteria {
	fromDate?: string;
	kind?: TransactionKind;
	limit?: number;
	offset?: number;
	toDate?: string;
}

interface TransactionPage {
	items: Transaction[];
	total: number;
}

interface TransactionRepository {
	save(transaction: Transaction): Promise<void>;
	search(criteria?: TransactionCriteria): Promise<TransactionPage>;
}

export type { TransactionCriteria, TransactionPage, TransactionRepository };
