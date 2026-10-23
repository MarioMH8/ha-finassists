import { describe, expect, it } from 'bun:test';

import { AccountMother } from '../domain/account.mother';
import { MockAccountRepository } from '../infrastructure/repositories/mock-account.repository';
import { ReopenAccount } from './reopen-account.use-case';

describe('ReopenAccount', () => {
	describe('execute', () => {
		it('should persist the reopened account and return true when the account is closed', () => {
			const repository = new MockAccountRepository();
			const account = AccountMother.create({ closedAt: '2026-01-01T00:00:00.000Z' });
			repository.shouldFind(account);
			const useCase = new ReopenAccount(repository);

			const isReopened = useCase.execute('book-1', 'account-1');

			expect(isReopened).toBe(true);
			repository.assertFindHasBeenCalledWith({ bookId: 'book-1', id: 'account-1' });
			repository.assertSaveHasBeenCalledWith(account.reopen());
		});

		it('should return false without saving when the account does not exist', () => {
			const repository = new MockAccountRepository();
			const useCase = new ReopenAccount(repository);

			expect(useCase.execute('book-1', 'missing')).toBe(false);
			repository.assertSaveHasNotBeenCalled();
		});

		it('should return false without saving when the account is not closed', () => {
			const repository = new MockAccountRepository();
			repository.shouldFind(AccountMother.create());
			const useCase = new ReopenAccount(repository);

			expect(useCase.execute('book-1', 'account-1')).toBe(false);
			repository.assertSaveHasNotBeenCalled();
		});
	});
});
