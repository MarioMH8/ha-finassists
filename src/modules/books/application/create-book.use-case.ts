import { randomUUID } from 'node:crypto';

import type { BookRepository } from '../domain';
import { Book } from '../domain';

interface CreateBookInput {
	currencyCode: string;
	name: string;
}

class CreateBook {
	constructor(private readonly repository: BookRepository) {}

	execute(input: CreateBookInput): Book {
		const book = Book.create({ ...input, id: randomUUID() });
		this.repository.save(book);

		return book;
	}
}

export { CreateBook, type CreateBookInput };
