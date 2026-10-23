import { expect, mock } from 'bun:test';

import type { ApiToken, ApiTokenCriteria, ApiTokenDeleteCriteria, ApiTokenRepository } from '../../domain';

export class MockApiTokenRepository implements ApiTokenRepository {
	private readonly deleteMock = mock<ApiTokenRepository['delete']>(() => Promise.resolve(false));
	private readonly findMock = mock<ApiTokenRepository['find']>(() => Promise.resolve(undefined));
	private readonly saveMock = mock<ApiTokenRepository['save']>(() => Promise.resolve());
	private readonly searchMock = mock<ApiTokenRepository['search']>(() => Promise.resolve([]));

	assertDeleteHasBeenCalledWith(criteria: ApiTokenDeleteCriteria): void {
		expect(this.deleteMock).toHaveBeenCalledWith(criteria);
	}

	assertFindHasBeenCalledWith(criteria: ApiTokenCriteria): void {
		expect(this.findMock).toHaveBeenCalledWith(criteria);
	}

	assertSaveHasBeenCalledWith(token: ApiToken): void {
		expect(this.saveMock).toHaveBeenCalledWith(token);
	}

	assertSearchHasBeenCalledWith(criteria: ApiTokenCriteria): void {
		expect(this.searchMock).toHaveBeenCalledWith(criteria);
	}

	async delete(criteria: ApiTokenDeleteCriteria): Promise<boolean> {
		return this.deleteMock(criteria);
	}

	async find(criteria: ApiTokenCriteria): Promise<ApiToken | undefined> {
		return this.findMock(criteria);
	}

	async save(token: ApiToken): Promise<void> {
		return this.saveMock(token);
	}

	async search(criteria?: ApiTokenCriteria): Promise<ApiToken[]> {
		return criteria === undefined ? this.searchMock() : this.searchMock(criteria);
	}

	shouldDelete(isDeleted: boolean): void {
		this.deleteMock.mockResolvedValue(isDeleted);
	}

	shouldFind(token: ApiToken | undefined): void {
		this.findMock.mockResolvedValue(token);
	}

	shouldSearch(tokens: ApiToken[]): void {
		this.searchMock.mockResolvedValue(tokens);
	}
}
