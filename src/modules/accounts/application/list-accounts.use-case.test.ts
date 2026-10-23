import { ListAccounts } from '@modules/accounts';
import { describe, expect, it } from 'bun:test';

import { AccountMother } from '../domain/account.mother';
import { MockAccountRepository } from '../infrastructure/repositories/mock-account.repository';

describe('ListAccounts', () => {
	describe('execute', () => {
		it('should search only open accounts of the book by default', () => {
			const repository = new MockAccountRepository();
			const accounts = [AccountMother.create()];
			repository.shouldSearch(accounts);
			const useCase = new ListAccounts(repository);

			expect(useCase.execute({ bookId: 'book-1' })).toEqual(accounts);
			repository.assertSearchHasBeenCalledWith({ bookId: 'book-1', closed: false });
		});

		it('should search every account of the book when closed accounts are included', () => {
			const repository = new MockAccountRepository();
			const accounts = [
				AccountMother.create(),
				AccountMother.create({ closedAt: '2026-01-01T00:00:00.000Z', id: 'account-2' }),
			];
			repository.shouldSearch(accounts);
			const useCase = new ListAccounts(repository);

			expect(useCase.execute({ bookId: 'book-1', includeClosed: true })).toEqual(accounts);
			repository.assertSearchHasBeenCalledWith({ bookId: 'book-1' });
		});
	});
});
