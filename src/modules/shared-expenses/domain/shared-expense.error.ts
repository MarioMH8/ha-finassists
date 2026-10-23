class SharedExpenseIdInvalidError extends Error {
	constructor() {
		super('Shared expense id must not be empty');
		this.name = 'SharedExpenseIdInvalidError';
	}
}

class SharedExpenseBookIdInvalidError extends Error {
	constructor() {
		super('Shared expense book id must not be empty');
		this.name = 'SharedExpenseBookIdInvalidError';
	}
}

class SharedExpenseBookNotFoundError extends Error {
	constructor() {
		super('Book not found');
		this.name = 'SharedExpenseBookNotFoundError';
	}
}

class SharedExpenseBookArchivedError extends Error {
	constructor() {
		super('Cannot create shared expenses in an archived book');
		this.name = 'SharedExpenseBookArchivedError';
	}
}

class SharedExpenseActorInvalidError extends Error {
	constructor() {
		super('Expense actor kind is not supported');
		this.name = 'SharedExpenseActorInvalidError';
	}
}

class SharedExpenseActorIdInvalidError extends Error {
	constructor() {
		super('Expense actor id must not be empty');
		this.name = 'SharedExpenseActorIdInvalidError';
	}
}

class SharedExpenseDescriptionInvalidError extends Error {
	constructor() {
		super('Shared expense description must contain between 1 and 200 characters');
		this.name = 'SharedExpenseDescriptionInvalidError';
	}
}

class SharedExpenseAmountInvalidError extends TypeError {
	constructor() {
		super('Expense minor units must be a safe integer');
		this.name = 'SharedExpenseAmountInvalidError';
	}
}

class SharedExpenseAmountNonPositiveError extends Error {
	constructor() {
		super('Expense amount must be greater than zero');
		this.name = 'SharedExpenseAmountNonPositiveError';
	}
}

class SharedExpenseParticipantsMissingError extends Error {
	constructor() {
		super('Shared expense must have at least one participant');
		this.name = 'SharedExpenseParticipantsMissingError';
	}
}

class SharedExpenseParticipantsDuplicateError extends Error {
	constructor() {
		super('Shared expense participants must be unique');
		this.name = 'SharedExpenseParticipantsDuplicateError';
	}
}

class SharedExpenseParticipantBookMismatchError extends Error {
	constructor() {
		super('Shared expense participants must belong to the same book');
		this.name = 'SharedExpenseParticipantBookMismatchError';
	}
}

class SharedExpenseParticipantInactiveError extends Error {
	constructor(id: string) {
		super(`Participant ${id} is no longer active`);
		this.name = 'SharedExpenseParticipantInactiveError';
	}
}

class SharedExpenseAllocationsInvalidError extends Error {
	constructor() {
		super('Shared expense allocations are invalid');
		this.name = 'SharedExpenseAllocationsInvalidError';
	}
}

class SharedExpenseAllocationTotalMismatchError extends Error {
	constructor() {
		super('Shared expense allocations must sum to the expense amount');
		this.name = 'SharedExpenseAllocationTotalMismatchError';
	}
}

class SharedExpenseSettlementsInvalidError extends Error {
	constructor() {
		super('Each settlement must match its participant allocation');
		this.name = 'SharedExpenseSettlementsInvalidError';
	}
}

class SharedExpenseSettlementStatusInvalidError extends Error {
	constructor() {
		super('Shared expense settlement status is not supported');
		this.name = 'SharedExpenseSettlementStatusInvalidError';
	}
}

class SharedExpenseTransitionInvalidError extends Error {
	constructor(from: string, to: string) {
		super(`Cannot transition a ${from} shared expense to ${to}`);
		this.name = 'SharedExpenseTransitionInvalidError';
	}
}

class SharedExpenseSettlementTransitionInvalidError extends Error {
	constructor(participantId: string) {
		super(`Cannot settle participant ${participantId} for this shared expense`);
		this.name = 'SharedExpenseSettlementTransitionInvalidError';
	}
}

export {
	SharedExpenseActorIdInvalidError,
	SharedExpenseActorInvalidError,
	SharedExpenseAllocationsInvalidError,
	SharedExpenseAllocationTotalMismatchError,
	SharedExpenseAmountInvalidError,
	SharedExpenseAmountNonPositiveError,
	SharedExpenseBookArchivedError,
	SharedExpenseBookIdInvalidError,
	SharedExpenseBookNotFoundError,
	SharedExpenseDescriptionInvalidError,
	SharedExpenseIdInvalidError,
	SharedExpenseParticipantBookMismatchError,
	SharedExpenseParticipantInactiveError,
	SharedExpenseParticipantsDuplicateError,
	SharedExpenseParticipantsMissingError,
	SharedExpenseSettlementsInvalidError,
	SharedExpenseSettlementStatusInvalidError,
	SharedExpenseSettlementTransitionInvalidError,
	SharedExpenseTransitionInvalidError,
};
