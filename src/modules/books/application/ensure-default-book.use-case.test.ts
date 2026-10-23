import { describe, expect, it } from 'bun:test';

import { BookMother } from '../domain/book.mother';
import { MockBookRepository } from '../infrastructure/repositories/mock-book.repository';
import { EnsureDefaultBook } from './ensure-default-book.use-case';

describe('EnsureDefaultBook', () => {
	describe('execute', () => {
		it('should return the existing default book without saving', () => {
			const repository = new MockBookRepository();
			const existing = BookMother.create({ id: 'existing', isDefault: true });
			repository.shouldFind(existing);
			const useCase = new EnsureDefaultBook(repository);

			expect(useCase.execute()).toBe(existing);
			repository.assertFindHasBeenCalledWith({ isDefault: true });
			repository.assertSaveHasNotBeenCalled();
		});

		it('should create and save the Household default book when none exists', () => {
			const repository = new MockBookRepository();
			const useCase = new EnsureDefaultBook(repository);

			const book = useCase.execute();

			expect(book).toMatchObject({ currencyCode: 'EUR', id: 'default', isDefault: true, name: 'Household' });
			repository.assertSaveHasBeenCalledWith(book);
		});
	});
});
