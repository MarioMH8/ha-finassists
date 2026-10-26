import { expect, mock } from 'bun:test';

import type { Category, CategoryCriteria, CategoryKind, CategoryRepository, CategorySummary } from '../../domain';

export class MockCategoryRepository implements CategoryRepository {
	private readonly countTransactionsMock = mock<CategoryRepository['countTransactions']>(() => Promise.resolve(0));

	private readonly deleteMock = mock<CategoryRepository['delete']>(() => Promise.resolve(false));
	private readonly findByIdMock = mock<CategoryRepository['findById']>(() => Promise.resolve(undefined));
	private readonly findByNameMock = mock<CategoryRepository['findByName']>(() => Promise.resolve(undefined));
	private readonly saveMock = mock<CategoryRepository['save']>(() => Promise.resolve());
	private readonly searchMock = mock<CategoryRepository['search']>(() => Promise.resolve([]));
	private readonly updateMock = mock<CategoryRepository['update']>(() => Promise.resolve(false));

	get saved(): Category[] {
		return this.saveMock.mock.calls.map(([category]) => category);
	}

	assertDeleteHasBeenCalledWith(id: string): void {
		expect(this.deleteMock).toHaveBeenCalledWith(id);
	}

	assertSaveHasBeenCalledWith(category: Category): void {
		expect(this.saveMock).toHaveBeenCalledWith(category);
	}

	async countTransactions(id: string): Promise<number> {
		return this.countTransactionsMock(id);
	}

	async delete(id: string): Promise<boolean> {
		return this.deleteMock(id);
	}

	async findById(id: string): Promise<Category | undefined> {
		return this.findByIdMock(id);
	}

	async findByName(kind: CategoryKind, name: string): Promise<Category | undefined> {
		return this.findByNameMock(kind, name);
	}

	async save(category: Category): Promise<void> {
		return this.saveMock(category);
	}

	async search(criteria: CategoryCriteria = {}): Promise<CategorySummary[]> {
		return this.searchMock(criteria);
	}

	shouldCountTransactions(total: number): void {
		this.countTransactionsMock.mockResolvedValue(total);
	}

	shouldDelete(isDeleted: boolean): void {
		this.deleteMock.mockResolvedValue(isDeleted);
	}

	shouldFind(category: Category | undefined): void {
		this.findByIdMock.mockResolvedValue(category);
	}

	shouldFindByName(category: Category | undefined): void {
		this.findByNameMock.mockResolvedValue(category);
	}

	shouldSearch(summaries: CategorySummary[]): void {
		this.searchMock.mockResolvedValue(summaries);
	}

	shouldUpdate(isUpdated: boolean): void {
		this.updateMock.mockResolvedValue(isUpdated);
	}

	async update(category: Category): Promise<boolean> {
		return this.updateMock(category);
	}
}
