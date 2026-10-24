import type { Book } from '@modules/books/domain/book';

interface BookCriteria {
	archivedAt?: null | string;
	currencyCode?: string;
	id?: string;
	isDefault?: boolean;
	name?: string;
}

interface BookRepository {
	delete(criteria: Pick<BookCriteria, 'id'>): boolean;
	find(criteria: BookCriteria): Book | undefined;
	save(book: Book): void;
	search(criteria?: BookCriteria): Book[];
}

export type { BookCriteria, BookRepository };
