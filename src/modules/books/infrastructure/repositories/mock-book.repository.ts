import { expect, mock } from 'bun:test';

import type { Book, BookCriteria, BookRepository } from '../../domain';

export class MockBookRepository implements BookRepository {
	private readonly deleteMock = mock<BookRepository['delete']>(() => false);
	private readonly findMock = mock<BookRepository['find']>();
	private readonly saveMock = mock<BookRepository['save']>();
	private readonly searchMock = mock<BookRepository['search']>(() => []);

	assertDeleteHasBeenCalledWith(criteria: Pick<BookCriteria, 'id'>): void {
		expect(this.deleteMock).toHaveBeenCalledWith(criteria);
	}

	assertFindHasBeenCalledWith(criteria: BookCriteria): void {
		expect(this.findMock).toHaveBeenCalledWith(criteria);
	}

	assertSaveHasBeenCalledWith(book: Book): void {
		expect(this.saveMock).toHaveBeenCalledWith(book);
	}

	assertSaveHasNotBeenCalled(): void {
		expect(this.saveMock).not.toHaveBeenCalled();
	}

	assertSearchHasBeenCalledWith(criteria?: BookCriteria): void {
		expect(this.searchMock).toHaveBeenCalledWith(...(criteria === undefined ? [] : [criteria]));
	}

	delete(criteria: Pick<BookCriteria, 'id'>): boolean {
		return this.deleteMock(criteria);
	}

	find(criteria: BookCriteria): Book | undefined {
		return this.findMock(criteria);
	}

	save(book: Book): void {
		this.saveMock(book);
	}

	search(criteria?: BookCriteria): Book[] {
		return criteria === undefined ? this.searchMock() : this.searchMock(criteria);
	}

	shouldDelete(isDeleted: boolean): void {
		this.deleteMock.mockReturnValue(isDeleted);
	}

	shouldFind(book: Book | undefined): void {
		this.findMock.mockReturnValue(book);
	}

	shouldSearch(books: Book[]): void {
		this.searchMock.mockReturnValue(books);
	}
}
