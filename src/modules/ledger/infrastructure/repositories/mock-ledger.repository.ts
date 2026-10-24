import { expect, mock } from 'bun:test';

import type { Transaction, TransactionCriteria, TransactionPage, TransactionRepository } from '../../domain';

export class MockLedgerRepository implements TransactionRepository {
	private readonly saveMock = mock<TransactionRepository['save']>(() => Promise.resolve());
	private readonly searchMock = mock<TransactionRepository['search']>(() => Promise.resolve({ items: [], total: 0 }));

	get saved(): Transaction[] {
		return this.saveMock.mock.calls.map(([transaction]) => transaction);
	}

	assertSaveHasBeenCalledWith(transaction: Transaction): void {
		expect(this.saveMock).toHaveBeenCalledWith(transaction);
	}

	assertSearchHasBeenCalledWith(criteria: TransactionCriteria): void {
		expect(this.searchMock).toHaveBeenCalledWith(criteria);
	}

	async save(transaction: Transaction): Promise<void> {
		return this.saveMock(transaction);
	}

	async search(criteria: TransactionCriteria = {}): Promise<TransactionPage> {
		return this.searchMock(criteria);
	}

	shouldSearch(page: TransactionPage): void {
		this.searchMock.mockResolvedValueOnce(page);
	}
}
