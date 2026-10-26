import type {
	ScheduledTransaction,
	ScheduledTransactionCriteria,
	ScheduledTransactionPage,
	ScheduledTransactionRepository,
} from '@modules/ledger/domain';
import { expect, mock } from 'bun:test';

export class MockScheduledTransactionRepository implements ScheduledTransactionRepository {
	private readonly deleteMock = mock<ScheduledTransactionRepository['delete']>(() => Promise.resolve(false));
	private readonly findByIdMock = mock<ScheduledTransactionRepository['findById']>(() => Promise.resolve(undefined));
	private readonly saveMock = mock<ScheduledTransactionRepository['save']>(() => Promise.resolve());
	private readonly searchMock = mock<ScheduledTransactionRepository['search']>(() =>
		Promise.resolve({ items: [], total: 0 })
	);

	private readonly updateMock = mock<ScheduledTransactionRepository['update']>(() => Promise.resolve(false));

	get saved(): ScheduledTransaction[] {
		return this.saveMock.mock.calls.map(([schedule]) => schedule);
	}

	get searchedCriteria(): ScheduledTransactionCriteria[] {
		return this.searchMock.mock.calls.map(([criteria]) => criteria ?? {});
	}

	get updated(): ScheduledTransaction[] {
		return this.updateMock.mock.calls.map(([schedule]) => schedule);
	}

	assertDeleteHasBeenCalledWith(id: string): void {
		expect(this.deleteMock).toHaveBeenCalledWith(id);
	}

	assertSaveHasBeenCalledWith(schedule: ScheduledTransaction): void {
		expect(this.saveMock).toHaveBeenCalledWith(schedule);
	}

	async delete(id: string): Promise<boolean> {
		return this.deleteMock(id);
	}

	async findById(id: string): Promise<ScheduledTransaction | undefined> {
		return this.findByIdMock(id);
	}

	async save(schedule: ScheduledTransaction): Promise<void> {
		return this.saveMock(schedule);
	}

	async search(criteria: ScheduledTransactionCriteria = {}): Promise<ScheduledTransactionPage> {
		return this.searchMock(criteria);
	}

	shouldDelete(isDeleted: boolean): void {
		this.deleteMock.mockResolvedValue(isDeleted);
	}

	shouldFind(schedule: ScheduledTransaction | undefined): void {
		this.findByIdMock.mockResolvedValue(schedule);
	}

	shouldSearch(page: ScheduledTransactionPage): void {
		this.searchMock.mockResolvedValue(page);
	}

	shouldUpdate(isUpdated: boolean): void {
		this.updateMock.mockResolvedValue(isUpdated);
	}

	async update(schedule: ScheduledTransaction, expectedVersion: number): Promise<boolean> {
		return this.updateMock(schedule, expectedVersion);
	}
}
