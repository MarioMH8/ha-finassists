import { afterEach, beforeEach, describe, expect, it, setSystemTime } from 'bun:test';

import { BookMother } from '../domain/book.mother';
import { MockBookRepository } from '../infrastructure/repositories/mock-book.repository';
import { ArchiveBook } from './archive-book.use-case';

const NOW = '2026-02-01T00:00:00.000Z';

describe('ArchiveBook', () => {
	beforeEach(() => {
		setSystemTime(new Date(NOW));
	});

	afterEach(() => {
		setSystemTime();
	});

	describe('execute', () => {
		it('should persist the archived book and return true when the book is active', () => {
			const repository = new MockBookRepository();
			const book = BookMother.create({ id: 'book-1' });
			repository.shouldFind(book);
			const useCase = new ArchiveBook(repository);

			const isArchived = useCase.execute('book-1');

			expect(isArchived).toBe(true);
			repository.assertFindHasBeenCalledWith({ id: 'book-1' });
			repository.assertSaveHasBeenCalledWith(book.archive(NOW));
		});

		it('should return false without saving when the book does not exist', () => {
			const repository = new MockBookRepository();
			const useCase = new ArchiveBook(repository);

			expect(useCase.execute('missing')).toBe(false);
			repository.assertSaveHasNotBeenCalled();
		});

		it('should return false without saving when the book is already archived', () => {
			const repository = new MockBookRepository();
			repository.shouldFind(BookMother.create({ archivedAt: '2026-01-01T00:00:00.000Z' }));
			const useCase = new ArchiveBook(repository);

			expect(useCase.execute('book-1')).toBe(false);
			repository.assertSaveHasNotBeenCalled();
		});
	});
});
