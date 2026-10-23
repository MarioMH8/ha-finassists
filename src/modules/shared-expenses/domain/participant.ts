interface SharedExpenseParticipantInput {
	bookId: string;
	createdAt?: string;
	id: string;
	name: string;
	removedAt?: string;
}

interface SharedExpenseParticipant {
	bookId: string;
	createdAt: string;
	id: string;
	name: string;
	removedAt?: string;
}

function createSharedExpenseParticipant(input: SharedExpenseParticipantInput): SharedExpenseParticipant {
	if (input.id.trim().length === 0) {
		throw new Error('Participant id must not be empty');
	}
	if (input.bookId.trim().length === 0) {
		throw new Error('Participant book id must not be empty');
	}
	if (input.name.trim().length === 0 || input.name.trim().length > 120) {
		throw new Error('Participant name must contain between 1 and 120 characters');
	}

	const id = input.id.trim();
	const bookId = input.bookId.trim();
	const name = input.name.trim();

	return {
		bookId,
		createdAt: input.createdAt ?? new Date().toISOString(),
		id,
		name,
		...(input.removedAt !== undefined && { removedAt: input.removedAt }),
	};
}

export { createSharedExpenseParticipant, type SharedExpenseParticipant, type SharedExpenseParticipantInput };
