import type { BookRepository } from '@modules/books/domain';

class ArchiveBook {
	constructor(private readonly repository: BookRepository) {}

	execute(id: string): boolean {
		const book = this.repository.find({ id });
		if (book?.archivedAt !== null) {
			return false;
		}

		this.repository.save(book.archive(new Date().toISOString()));

		return true;
	}
}

export { ArchiveBook };
