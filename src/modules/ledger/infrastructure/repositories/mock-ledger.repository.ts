import { expect, mock } from 'bun:test';

import type {
	Transaction,
	TransactionCriteria,
	TransactionDeleteCriteria,
	TransactionPage,
	TransactionRepository,
} from '../../domain';

export class MockLedgerRepository implements TransactionRepository {
	private readonly deleteMock = mock<TransactionRepository['delete']>(() => Promise.resolve(false));
	private readonly findByIdMock = mock<TransactionRepository['findById']>(() => Promise.resolve(undefined));
	private readonly saveMock = mock<TransactionRepository['save']>(() => Promise.resolve());
	private readonly searchMock = mock<TransactionRepository['search']>(() => Promise.resolve({ items: [], total: 0 }));
	private readonly updateMock = mock<TransactionRepository['update']>(() => Promise.resolve(false));

	get saved(): Transaction[] {
		return this.saveMock.mock.calls.map(([transaction]) => transaction);
	}

	assertDeleteHasBeenCalledWith(criteria: TransactionDeleteCriteria): void {
		expect(this.deleteMock).toHaveBeenCalledWith(criteria);
	}

	assertSaveHasBeenCalledWith(transaction: Transaction): void {
		expect(this.saveMock).toHaveBeenCalledWith(transaction);
	}

	assertSearchHasBeenCalledWith(criteria: TransactionCriteria): void {
		expect(this.searchMock).toHaveBeenCalledWith(criteria);
	}

	async delete(criteria: TransactionDeleteCriteria): Promise<boolean> {
		return this.deleteMock(criteria);
	}

	async findById(id: string): Promise<Transaction | undefined> {
		return this.findByIdMock(id);
	}

	async save(transaction: Transaction): Promise<void> {
		return this.saveMock(transaction);
	}

	async search(criteria: TransactionCriteria = {}): Promise<TransactionPage> {
		return this.searchMock(criteria);
	}

	shouldDelete(isDeleted: boolean): void {
		this.deleteMock.mockResolvedValue(isDeleted);
	}

	shouldFind(transaction: Transaction | undefined): void {
		this.findByIdMock.mockResolvedValue(transaction);
	}

	shouldSearch(page: TransactionPage): void {
		this.searchMock.mockResolvedValueOnce(page);
	}

	shouldUpdate(isUpdated: boolean): void {
		this.updateMock.mockResolvedValue(isUpdated);
	}

	async update(transaction: Transaction): Promise<boolean> {
		return this.updateMock(transaction);
	}
}
