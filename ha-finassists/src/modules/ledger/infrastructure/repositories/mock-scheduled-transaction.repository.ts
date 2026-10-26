import type {
	ScheduledOccurrencePosting,
	ScheduledTransaction,
	ScheduledTransactionCriteria,
	ScheduledTransactionPage,
	ScheduledTransactionRepository,
} from '@modules/ledger/domain';
import { expect, mock } from 'bun:test';

export class MockScheduledTransactionRepository implements ScheduledTransactionRepository {
	private readonly countByCategoryMock = mock<ScheduledTransactionRepository['countByCategory']>(() =>
		Promise.resolve(0)
	);

	private readonly deleteMock = mock<ScheduledTransactionRepository['delete']>(() => Promise.resolve(false));
	private readonly findByIdMock = mock<ScheduledTransactionRepository['findById']>(() => Promise.resolve(undefined));
	private readonly findDueAutomaticMock = mock<ScheduledTransactionRepository['findDueAutomatic']>(() =>
		Promise.resolve([])
	);

	private readonly saveMock = mock<ScheduledTransactionRepository['save']>(() => Promise.resolve());
	private readonly savePostedOccurrenceMock = mock<ScheduledTransactionRepository['savePostedOccurrence']>(() =>
		Promise.resolve(true)
	);

	private readonly searchMock = mock<ScheduledTransactionRepository['search']>(() =>
		Promise.resolve({ items: [], total: 0 })
	);

	private readonly updateMock = mock<ScheduledTransactionRepository['update']>(() => Promise.resolve(false));

	get posted(): ScheduledOccurrencePosting[] {
		return this.savePostedOccurrenceMock.mock.calls.map(([posting]) => posting);
	}

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

	async countByCategory(id: string): Promise<number> {
		return this.countByCategoryMock(id);
	}

	async delete(id: string): Promise<boolean> {
		return this.deleteMock(id);
	}

	async findById(id: string): Promise<ScheduledTransaction | undefined> {
		return this.findByIdMock(id);
	}

	async findDueAutomatic(today: string, limit?: number): Promise<ScheduledTransaction[]> {
		return this.findDueAutomaticMock(today, limit);
	}

	async save(schedule: ScheduledTransaction): Promise<void> {
		return this.saveMock(schedule);
	}

	async savePostedOccurrence(posting: ScheduledOccurrencePosting): Promise<boolean> {
		return this.savePostedOccurrenceMock(posting);
	}

	async search(criteria: ScheduledTransactionCriteria = {}): Promise<ScheduledTransactionPage> {
		return this.searchMock(criteria);
	}

	shouldCountByCategory(total: number): void {
		this.countByCategoryMock.mockResolvedValue(total);
	}

	shouldDelete(isDeleted: boolean): void {
		this.deleteMock.mockResolvedValue(isDeleted);
	}

	shouldFind(schedule: ScheduledTransaction | undefined): void {
		this.findByIdMock.mockResolvedValue(schedule);
	}

	shouldFindDue(schedules: ScheduledTransaction[]): void {
		this.findDueAutomaticMock.mockResolvedValue(schedules);
	}

	shouldSavePostedOccurrence(isSaved: boolean): void {
		this.savePostedOccurrenceMock.mockResolvedValue(isSaved);
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
