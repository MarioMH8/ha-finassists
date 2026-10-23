import type { TransactionTotals } from '../account';

interface AccountTransactionTotalsCriteria {
	accountId: string;
	asOf?: string;
	bookId: string;
}

interface AccountTransactionTotalsQuery {
	sumByStatus(criteria: AccountTransactionTotalsCriteria): TransactionTotals;
}

export type { AccountTransactionTotalsCriteria, AccountTransactionTotalsQuery };
