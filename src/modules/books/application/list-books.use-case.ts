import type { BookRepository } from '@modules/books/domain';

class ListBooks {
	constructor(private readonly repository: BookRepository) {}

	execute(): ReturnType<BookRepository['search']> {
		return this.repository.search();
	}
}

export { ListBooks };
