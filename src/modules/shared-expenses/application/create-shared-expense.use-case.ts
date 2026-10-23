import { randomUUID } from 'node:crypto';

import type { BookRepository } from '@modules/books/domain';
import type { IngressActor } from '@modules/home-assistant/domain';

import type { SharedExpense, SharedExpenseRepository } from '../domain';
import { createSharedExpense } from '../domain';

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
		const book = this.books.find(input.bookId);
		if (!book) {
			throw new Error('Book not found');
		}
		if (book.archivedAt !== null) {
			throw new Error('Cannot create shared expenses in an archived book');
		}

		const seen = new Set<string>();
		const participants = input.participantIds.map(id => {
			if (seen.has(id)) {
				throw new Error('Shared expense participants must be unique');
			}
			seen.add(id);

			const participant = this.expenses.findParticipant(input.bookId, id);
			if (participant?.id === undefined || participant.removedAt !== undefined) {
				throw new Error(`Active participant ${id} not found in book`);
			}

			return participant;
		});

		return this.expenses.create(createSharedExpense({ ...input, id: randomUUID(), participants }));
	}
}

export { CreateSharedExpense, type CreateSharedExpenseInput };
