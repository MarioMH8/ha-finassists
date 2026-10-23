import type { BookRepository } from '../domain';

class ListBooks {
	constructor(private readonly repository: BookRepository) {}

	execute(): ReturnType<BookRepository['list']> {
		return this.repository.list();
	}
}

export { ListBooks };
