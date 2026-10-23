import type { BookRepository } from '@modules/books/domain';

import type { SharedExpenseParticipant, SharedExpenseRepository } from '../domain';
import { createSharedExpenseParticipant } from '../domain';

interface CreateSharedExpenseParticipantInput {
	bookId: string;
	id: string;
	name: string;
}

class CreateSharedExpenseParticipant {
	constructor(
		private readonly expenses: SharedExpenseRepository,
		private readonly books: BookRepository
	) {}

	execute(input: CreateSharedExpenseParticipantInput): SharedExpenseParticipant {
		const book = this.books.find(input.bookId);
		if (!book) {
			throw new Error('Book not found');
		}
		if (book.archivedAt !== null) {
			throw new Error('Cannot add participants to an archived book');
		}

		const participant = createSharedExpenseParticipant(input);
		this.expenses.createParticipant(participant);

		return participant;
	}
}

export { CreateSharedExpenseParticipant, type CreateSharedExpenseParticipantInput };
