import type { BookRepository } from '../domain';
import { createBook } from '../domain';

class EnsureDefaultBook {
	constructor(private readonly repository: BookRepository) {}

	execute(): ReturnType<BookRepository['ensureDefault']> {
		return this.repository.ensureDefault(
			createBook({ currencyCode: 'EUR', id: 'default', isDefault: true, name: 'Household' })
		);
	}
}

export { EnsureDefaultBook };
