import type { BookInput } from './book';
import { Book } from './book';

export class BookMother {
	static create(overrides: Partial<BookInput> = {}): Book {
		return Book.create({ currencyCode: 'EUR', id: 'book-1', name: 'Household', ...overrides });
	}
}
