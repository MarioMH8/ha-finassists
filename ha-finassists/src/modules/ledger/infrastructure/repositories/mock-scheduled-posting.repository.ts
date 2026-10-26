import type {
	ScheduledOccurrencePosting,
	ScheduledPostingRepository,
	ScheduledTransaction,
	ScheduledTransactionCriteria,
	ScheduledTransactionPage,
} from '@modules/ledger/domain';
import { mock } from 'bun:test';

export class MockScheduledPostingRepository implements ScheduledPostingRepository {
	private readonly findByIdMock = mock<ScheduledPostingRepository['findById']>(() => Promise.resolve(undefined));
	private readonly savePostedOccurrenceMock = mock<ScheduledPostingRepository['savePostedOccurrence']>(() =>
		Promise.resolve(true)
	);

	private readonly searchMock = mock<ScheduledPostingRepository['search']>(() =>
		Promise.resolve({ items: [], total: 0 })
	);

	get posted(): ScheduledOccurrencePosting[] {
		return this.savePostedOccurrenceMock.mock.calls.map(([posting]) => posting);
	}

	get searchedCriteria(): ScheduledTransactionCriteria[] {
		return this.searchMock.mock.calls.map(([criteria]) => criteria ?? {});
	}

	async findById(id: string): Promise<ScheduledTransaction | undefined> {
		return this.findByIdMock(id);
	}

	async savePostedOccurrence(posting: ScheduledOccurrencePosting): Promise<boolean> {
		return this.savePostedOccurrenceMock(posting);
	}

	async search(criteria: ScheduledTransactionCriteria = {}): Promise<ScheduledTransactionPage> {
		return this.searchMock(criteria);
	}

	shouldFind(schedule: ScheduledTransaction | undefined): void {
		this.findByIdMock.mockResolvedValue(schedule);
	}

	shouldPost(isSaved: boolean): void {
		this.savePostedOccurrenceMock.mockResolvedValue(isSaved);
	}

	shouldSearch(page: ScheduledTransactionPage): void {
		this.searchMock.mockResolvedValue(page);
	}
}
