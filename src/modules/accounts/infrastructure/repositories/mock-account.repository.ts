import { expect, mock } from 'bun:test';

import type { Account, AccountCriteria, AccountDeleteCriteria, AccountRepository } from '../../domain';

export class MockAccountRepository implements AccountRepository {
	private readonly deleteMock = mock<AccountRepository['delete']>(() => false);
	private readonly findMock = mock<AccountRepository['find']>();
	private readonly saveMock = mock<AccountRepository['save']>();
	private readonly searchMock = mock<AccountRepository['search']>(() => []);

	assertDeleteHasBeenCalledWith(criteria: AccountDeleteCriteria): void {
		expect(this.deleteMock).toHaveBeenCalledWith(criteria);
	}

	assertFindHasBeenCalledWith(criteria: AccountCriteria): void {
		expect(this.findMock).toHaveBeenCalledWith(criteria);
	}

	assertFindHasNotBeenCalled(): void {
		expect(this.findMock).not.toHaveBeenCalled();
	}

	assertSaveHasBeenCalledWith(account: Account): void {
		expect(this.saveMock).toHaveBeenCalledWith(account);
	}

	assertSaveHasNotBeenCalled(): void {
		expect(this.saveMock).not.toHaveBeenCalled();
	}

	assertSearchHasBeenCalledWith(criteria?: AccountCriteria): void {
		expect(this.searchMock).toHaveBeenCalledWith(...(criteria === undefined ? [] : [criteria]));
	}

	delete(criteria: AccountDeleteCriteria): boolean {
		return this.deleteMock(criteria);
	}

	find(criteria: AccountCriteria): Account | undefined {
		return this.findMock(criteria);
	}

	save(account: Account): void {
		this.saveMock(account);
	}

	search(criteria?: AccountCriteria): Account[] {
		return criteria === undefined ? this.searchMock() : this.searchMock(criteria);
	}

	shouldDelete(isDeleted: boolean): void {
		this.deleteMock.mockReturnValue(isDeleted);
	}

	shouldFind(account: Account | undefined): void {
		this.findMock.mockReturnValue(account);
	}

	shouldSearch(accounts: Account[]): void {
		this.searchMock.mockReturnValue(accounts);
	}
}
