import type { Transaction, TransactionKind } from '../transaction';

interface TransactionCriteria {
	categoryId?: string;
	fromDate?: string;
	kind?: TransactionKind;
	limit?: number;
	offset?: number;
	search?: string;
	toDate?: string;
}

interface TransactionDeleteCriteria {
	id: string;
}

interface TransactionPage {
	items: Transaction[];
	total: number;
}

interface TransactionRepository {
	delete(criteria: TransactionDeleteCriteria): Promise<boolean>;
	deleteMany(ids: string[]): Promise<number>;
	findById(id: string): Promise<Transaction | undefined>;
	save(transaction: Transaction): Promise<void>;
	search(criteria?: TransactionCriteria): Promise<TransactionPage>;
	update(transaction: Transaction): Promise<boolean>;
}

export type { TransactionCriteria, TransactionDeleteCriteria, TransactionPage, TransactionRepository };
