import type { Book } from './book';

interface BookRepository {
	archive(id: string, archivedAt: string): boolean;
	create(book: Book): void;
	deleteIfEmpty(id: string): boolean;
	ensureDefault(book: Book): Book;
	find(id: string): Book | undefined;
	list(): Book[];
}

export type { BookRepository };
