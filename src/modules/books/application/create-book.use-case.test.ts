import { describe, expect, it } from 'bun:test';

import { BookNameInvalidError } from '../domain';
import { MockBookRepository } from '../infrastructure/repositories/mock-book.repository';
import { CreateBook } from './create-book.use-case';

describe('CreateBook', () => {
	describe('execute', () => {
		it('should persist and return a new book with a generated id', () => {
			const repository = new MockBookRepository();
			const useCase = new CreateBook(repository);

			const book = useCase.execute({ currencyCode: 'usd', name: ' Travel ' });

			expect(book.id).not.toBe('');
			expect(book.name).toBe('Travel');
			expect(book.currencyCode).toBe('USD');
			expect(book.archivedAt).toBeNull();
			repository.assertSaveHasBeenCalledWith(book);
		});

		it('should throw BookNameInvalidError without saving when the name is empty', () => {
			const repository = new MockBookRepository();
			const useCase = new CreateBook(repository);

			expect(() => useCase.execute({ currencyCode: 'EUR', name: '  ' })).toThrow(BookNameInvalidError);
			repository.assertSaveHasNotBeenCalled();
		});
	});
});
