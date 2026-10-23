import { randomUUID } from 'node:crypto';

import type { BookRepository } from '../domain';
import { createBook } from '../domain';

interface CreateBookInput {
	currencyCode: string;
	name: string;
}

class CreateBook {
	constructor(private readonly repository: BookRepository) {}

	execute(input: CreateBookInput): ReturnType<typeof createBook> {
		const book = createBook({ ...input, id: randomUUID() });
		this.repository.create(book);

		return book;
	}
}

export { CreateBook, type CreateBookInput };
