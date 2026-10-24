import { randomUUID } from 'node:crypto';

import type { BookRepository } from '@modules/books/domain';
import { Book } from '@modules/books/domain';

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
