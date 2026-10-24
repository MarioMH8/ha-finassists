import type { AccountBalances, AccountRepository, AccountTransactionTotalsQuery } from '@modules/accounts/domain';
import { AccountAsOfDateInvalidError, AccountNotFoundError } from '@modules/accounts/domain';
import type { BookRepository } from '@modules/books/domain';
import { Currency } from '@modules/money/domain';

interface GetAccountBalancesInput {
	/**
	 *Optional inclusive YYYY-MM-DD cut-off; without it every dated entry, including future ones, counts.
	 */
	asOf?: string;
	bookId: string;
	id: string;
}

class GetAccountBalances {
	constructor(
		private readonly accounts: AccountRepository,
		private readonly transactionTotals: AccountTransactionTotalsQuery,
		private readonly books: BookRepository
	) {}

	execute({ asOf, bookId, id }: GetAccountBalancesInput): AccountBalances {
		if (asOf !== undefined && !isIsoDate(asOf)) {
			throw new AccountAsOfDateInvalidError();
		}

		const book = this.books.find({ id: bookId });
		const account = book ? this.accounts.find({ bookId, id }) : undefined;
		if (!book || !account) {
			throw new AccountNotFoundError();
		}

		const totals = this.transactionTotals.sumByStatus({ accountId: id, asOf, bookId });

		return account.balances(totals, Currency.create(book.currencyCode));
	}
}

function isIsoDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}

	const date = new Date(`${value}T00:00:00Z`);

	return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export { GetAccountBalances, type GetAccountBalancesInput };
