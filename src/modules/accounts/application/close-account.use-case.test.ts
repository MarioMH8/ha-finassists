import { AccountMother } from '@modules/accounts/domain/account.mother';
import { MockAccountRepository } from '@modules/accounts/infrastructure/repositories/mock-account.repository';
import { afterEach, beforeEach, describe, expect, it, setSystemTime } from 'bun:test';

import { CloseAccount } from './close-account.use-case';

const NOW = '2026-02-01T00:00:00.000Z';

describe('CloseAccount', () => {
	beforeEach(() => {
		setSystemTime(new Date(NOW));
	});

	afterEach(() => {
		setSystemTime();
	});

	describe('execute', () => {
		it('should persist the closed account and return true when the account is open', () => {
			const repository = new MockAccountRepository();
			const account = AccountMother.create();
			repository.shouldFind(account);
			const useCase = new CloseAccount(repository);

			const isClosed = useCase.execute('book-1', 'account-1');

			expect(isClosed).toBe(true);
			repository.assertFindHasBeenCalledWith({ bookId: 'book-1', id: 'account-1' });
			repository.assertSaveHasBeenCalledWith(account.close(NOW));
		});

		it('should return false without saving when the account does not exist', () => {
			const repository = new MockAccountRepository();
			const useCase = new CloseAccount(repository);

			expect(useCase.execute('book-1', 'missing')).toBe(false);
			repository.assertSaveHasNotBeenCalled();
		});

		it('should return false without saving when the account is already closed', () => {
			const repository = new MockAccountRepository();
			repository.shouldFind(AccountMother.create({ closedAt: '2026-01-01T00:00:00.000Z' }));
			const useCase = new CloseAccount(repository);

			expect(useCase.execute('book-1', 'account-1')).toBe(false);
			repository.assertSaveHasNotBeenCalled();
		});
	});
});
