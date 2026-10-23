import { BookMother } from '@modules/books/domain/book.mother';
import { MockBookRepository } from '@modules/books/infrastructure/repositories/mock-book.repository';
import { Currency, Money } from '@modules/money/domain';
import { describe, expect, it } from 'bun:test';

import { AccountAsOfDateInvalidError, AccountNotFoundError } from '../domain';
import { AccountMother } from '../domain/account.mother';
import { MockAccountRepository } from '../infrastructure/repositories/mock-account.repository';
import { MockAccountTransactionTotalsQuery } from '../infrastructure/repositories/mock-account-transaction-totals.query';
import { GetAccountBalances } from './get-account-balances.use-case';

function createUseCase() {
	const accounts = new MockAccountRepository();
	const totals = new MockAccountTransactionTotalsQuery();
	const books = new MockBookRepository();

	return { accounts, books, totals, useCase: new GetAccountBalances(accounts, totals, books) };
}

describe('GetAccountBalances', () => {
	describe('execute', () => {
		it('should return balances in the book currency from the transaction totals', () => {
			const { accounts, books, totals, useCase } = createUseCase();
			books.shouldFind(BookMother.create({ currencyCode: 'EUR' }));
			accounts.shouldFind(AccountMother.create({ openingBalanceMinor: 1000 }));
			totals.shouldSum({ cleared: 50, reconciled: 100, uncleared: 25 });
			const eur = Currency.create('EUR');

			const balances = useCase.execute({ bookId: 'book-1', id: 'account-1' });

			expect(balances).toEqual({
				posted: Money.fromMinor(1150, eur),
				reconciled: Money.fromMinor(1100, eur),
				total: Money.fromMinor(1175, eur),
			});
			books.assertFindHasBeenCalledWith({ id: 'book-1' });
			accounts.assertFindHasBeenCalledWith({ bookId: 'book-1', id: 'account-1' });
			totals.assertSumByStatusHasBeenCalledWith({ accountId: 'account-1', asOf: undefined, bookId: 'book-1' });
		});

		it('should forward a valid as-of date to the totals query', () => {
			const { accounts, books, totals, useCase } = createUseCase();
			books.shouldFind(BookMother.create());
			accounts.shouldFind(AccountMother.create());

			useCase.execute({ asOf: '2026-02-28', bookId: 'book-1', id: 'account-1' });

			totals.assertSumByStatusHasBeenCalledWith({ accountId: 'account-1', asOf: '2026-02-28', bookId: 'book-1' });
		});

		it.each(['2026-2-1', 'yesterday', '2026-13-45', '2026-02-30'])(
			'should reject the invalid as-of date %s without querying',
			asOf => {
				const { totals, useCase } = createUseCase();

				expect(() => useCase.execute({ asOf, bookId: 'book-1', id: 'account-1' })).toThrow(
					AccountAsOfDateInvalidError
				);
				totals.assertSumByStatusHasNotBeenCalled();
			}
		);

		it('should fail without looking up the account when the book does not exist', () => {
			const { accounts, totals, useCase } = createUseCase();

			expect(() => useCase.execute({ bookId: 'book-1', id: 'account-1' })).toThrow(AccountNotFoundError);
			accounts.assertFindHasNotBeenCalled();
			totals.assertSumByStatusHasNotBeenCalled();
		});

		it('should fail when the account does not exist in the book', () => {
			const { books, totals, useCase } = createUseCase();
			books.shouldFind(BookMother.create());

			expect(() => useCase.execute({ bookId: 'book-1', id: 'missing' })).toThrow(AccountNotFoundError);
			totals.assertSumByStatusHasNotBeenCalled();
		});
	});
});
