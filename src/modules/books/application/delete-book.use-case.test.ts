import { MockBookRepository } from '@modules/books/infrastructure/repositories/mock-book.repository';
import { describe, expect, it } from 'bun:test';

import { DeleteBook } from './delete-book.use-case';

describe('DeleteBook', () => {
	describe('execute', () => {
		it('should return true when the repository deletes the book', () => {
			const repository = new MockBookRepository();
			repository.shouldDelete(true);
			const useCase = new DeleteBook(repository);

			expect(useCase.execute('book-1')).toBe(true);
			repository.assertDeleteHasBeenCalledWith({ id: 'book-1' });
		});

		it('should return false when the repository does not delete anything', () => {
			const repository = new MockBookRepository();
			const useCase = new DeleteBook(repository);

			expect(useCase.execute('missing')).toBe(false);
		});
	});
});
