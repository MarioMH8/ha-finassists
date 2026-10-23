import type { Account } from './account';
import type { TransactionTotals } from './account-balances';

interface ListAccountsOptions {
	includeClosed?: boolean;
}

interface AccountRepository {
	close(bookId: string, id: string, closedAt: string): boolean;
	create(account: Account): void;
	find(bookId: string, id: string): Account | undefined;
	list(bookId: string, options?: ListAccountsOptions): Account[];
	reopen(bookId: string, id: string): boolean;
	/**
	 *Sums transaction amounts per status; `asOf` (YYYY-MM-DD) keeps entries dated on or before it.
	 */
	sumTransactionsByStatus(bookId: string, accountId: string, asOf?: string): TransactionTotals;
}

export type { AccountRepository, ListAccountsOptions };
