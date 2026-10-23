import type { BookRepository } from '@modules/books/domain';

import type { SharedExpenseRepository } from '../domain';
import {
	SharedExpenseParticipant,
	SharedExpenseParticipantBookArchivedError,
	SharedExpenseParticipantBookNotFoundError,
} from '../domain';

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
		const book = this.books.find({ id: input.bookId });
		if (!book) {
			throw new SharedExpenseParticipantBookNotFoundError();
		}
		if (book.archivedAt !== null) {
			throw new SharedExpenseParticipantBookArchivedError();
		}

		const participant = SharedExpenseParticipant.create(input);
		this.expenses.createParticipant(participant);

		return participant;
	}
}

export { CreateSharedExpenseParticipant, type CreateSharedExpenseParticipantInput };
