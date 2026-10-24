import { BookMother } from '@modules/books/domain/book.mother';
import { MockBookRepository } from '@modules/books/infrastructure/repositories/mock-book.repository';
import { describe, expect, it } from 'bun:test';

import { ListBooks } from './list-books.use-case';

describe('ListBooks', () => {
	describe('execute', () => {
		it('should return every book from the repository', () => {
			const repository = new MockBookRepository();
			const books = [BookMother.create({ id: 'book-1' }), BookMother.create({ id: 'book-2' })];
			repository.shouldSearch(books);
			const useCase = new ListBooks(repository);

			expect(useCase.execute()).toEqual(books);
			repository.assertSearchHasBeenCalledWith();
		});
	});
});
