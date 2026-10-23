import type { BookRepository } from '../domain';

class ArchiveBook {
	constructor(private readonly repository: BookRepository) {}

	execute(id: string): boolean {
		return this.repository.archive(id, new Date().toISOString());
	}
}

export { ArchiveBook };
