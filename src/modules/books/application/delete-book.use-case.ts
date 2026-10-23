import type { BookRepository } from '../domain';

class DeleteBook {
	constructor(private readonly repository: BookRepository) {}

	execute(id: string): boolean {
		return this.repository.delete({ id });
	}
}

export { DeleteBook };
