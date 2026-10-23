import type { BookRepository } from '@modules/books/domain';
import { Currency } from '@modules/money/domain';

import type { AccountRepository } from '../domain';
import { deriveAccountBalances } from '../domain';

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
		private readonly books: BookRepository
	) {}

	execute({ asOf, bookId, id }: GetAccountBalancesInput): ReturnType<typeof deriveAccountBalances> {
		if (asOf !== undefined && !isIsoDate(asOf)) {
			throw new Error('asOf must be a valid YYYY-MM-DD date');
		}

		const book = this.books.find({ id: bookId });
		const account = book ? this.accounts.find(bookId, id) : undefined;
		if (!book || !account) {
			throw new Error('Account not found');
		}

		const totals = this.accounts.sumTransactionsByStatus(bookId, id, asOf);

		return deriveAccountBalances(account.openingBalanceMinor, totals, Currency.create(book.currencyCode));
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
