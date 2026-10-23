import type { BookRepository } from '../domain';
import { Book } from '../domain';

class EnsureDefaultBook {
	constructor(private readonly repository: BookRepository) {}

	execute(): Book {
		const existing = this.repository.find({ isDefault: true });
		if (existing) {
			return existing;
		}

		const book = Book.create({ currencyCode: 'EUR', id: 'default', isDefault: true, name: 'Household' });
		this.repository.save(book);

		return book;
	}
}

export { EnsureDefaultBook };
