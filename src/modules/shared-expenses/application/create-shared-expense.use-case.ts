import { randomUUID } from 'node:crypto';

import type { BookRepository } from '@modules/books/domain';
import type { IngressActor } from '@modules/home-assistant/domain';
import type { SharedExpenseRepository } from '@modules/shared-expenses/domain';
import {
	SharedExpense,
	SharedExpenseBookArchivedError,
	SharedExpenseBookNotFoundError,
	SharedExpenseParticipantInactiveError,
	SharedExpenseParticipantNotFoundError,
	SharedExpenseParticipantsDuplicateError,
} from '@modules/shared-expenses/domain';

interface CreateSharedExpenseInput {
	actor: IngressActor;
	amountMinor: number;
	bookId: string;
	createdAt?: string;
	description: string;
	participantIds: string[];
}

class CreateSharedExpense {
	constructor(
		private readonly expenses: SharedExpenseRepository,
		private readonly books: BookRepository
	) {}

	execute(input: CreateSharedExpenseInput): SharedExpense {
		const book = this.books.find({ id: input.bookId });
		if (!book) {
			throw new SharedExpenseBookNotFoundError();
		}
		if (book.archivedAt !== null) {
			throw new SharedExpenseBookArchivedError();
		}

		const seen = new Set<string>();
		const participants = input.participantIds.map(id => {
			if (seen.has(id)) {
				throw new SharedExpenseParticipantsDuplicateError();
			}
			seen.add(id);

			const participant = this.expenses.findParticipant(input.bookId, id);
			if (participant?.id === undefined) {
				throw new SharedExpenseParticipantNotFoundError(id);
			}
			if (participant.removedAt !== undefined) {
				throw new SharedExpenseParticipantInactiveError(id);
			}

			return participant;
		});

		return this.expenses.create(SharedExpense.create({ ...input, id: randomUUID(), participants }));
	}
}

export { CreateSharedExpense, type CreateSharedExpenseInput };
