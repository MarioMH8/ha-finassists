class SharedExpenseParticipantBookNotFoundError extends Error {
	constructor() {
		super('Book not found');
		this.name = 'SharedExpenseParticipantBookNotFoundError';
	}
}

class SharedExpenseParticipantBookArchivedError extends Error {
	constructor() {
		super('Cannot add participants to an archived book');
		this.name = 'SharedExpenseParticipantBookArchivedError';
	}
}

class SharedExpenseParticipantBookIdInvalidError extends Error {
	constructor() {
		super('Participant book id must not be empty');
		this.name = 'SharedExpenseParticipantBookIdInvalidError';
	}
}

class SharedExpenseParticipantIdInvalidError extends Error {
	constructor() {
		super('Participant id must not be empty');
		this.name = 'SharedExpenseParticipantIdInvalidError';
	}
}

class SharedExpenseParticipantNameInvalidError extends Error {
	constructor() {
		super('Participant name must contain between 1 and 120 characters');
		this.name = 'SharedExpenseParticipantNameInvalidError';
	}
}

export {
	SharedExpenseParticipantBookArchivedError,
	SharedExpenseParticipantBookIdInvalidError,
	SharedExpenseParticipantBookNotFoundError,
	SharedExpenseParticipantIdInvalidError,
	SharedExpenseParticipantNameInvalidError,
};
