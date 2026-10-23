import type { OccurrenceStatus } from './schedule-occurrence';

class ScheduleOccurrenceIdentityInvalidError extends Error {
	constructor() {
		super('Schedule occurrence identity must be non-empty');
		this.name = 'ScheduleOccurrenceIdentityInvalidError';
	}
}

class ScheduleOccurrenceNumberInvalidError extends Error {
	constructor() {
		super('Schedule occurrence number must be a non-negative safe integer');
		this.name = 'ScheduleOccurrenceNumberInvalidError';
	}
}

class ScheduleOccurrenceAmountInvalidError extends Error {
	constructor() {
		super('Schedule occurrence amount must be a non-zero safe integer');
		this.name = 'ScheduleOccurrenceAmountInvalidError';
	}
}

class ScheduleOccurrenceDateInvalidError extends Error {
	constructor() {
		super('Schedule occurrence date must be a valid YYYY-MM-DD calendar date');
		this.name = 'ScheduleOccurrenceDateInvalidError';
	}
}

class ScheduleOccurrenceUnavailableError extends Error {
	constructor() {
		super('The schedule has no occurrence at the requested number');
		this.name = 'ScheduleOccurrenceUnavailableError';
	}
}

class ScheduleOccurrenceGenerationLimitInvalidError extends Error {
	constructor() {
		super('Generation batch size must be between 1 and 500');
		this.name = 'ScheduleOccurrenceGenerationLimitInvalidError';
	}
}

class ScheduleOccurrenceGenerationThroughDateInvalidError extends Error {
	constructor() {
		super('Generation through date must be a valid YYYY-MM-DD calendar date');
		this.name = 'ScheduleOccurrenceGenerationThroughDateInvalidError';
	}
}

class ScheduleOccurrenceLedgerTransactionMismatchError extends Error {
	constructor() {
		super('Ledger transaction account and amount must match the scheduled occurrence');
		this.name = 'ScheduleOccurrenceLedgerTransactionMismatchError';
	}
}

class ScheduleOccurrenceLedgerTransactionNotFoundError extends Error {
	constructor() {
		super('Ledger transaction was not found in this book');
		this.name = 'ScheduleOccurrenceLedgerTransactionNotFoundError';
	}
}

class ScheduleOccurrenceLinkConflictError extends Error {
	constructor() {
		super('Occurrence is already recorded or could not be linked');
		this.name = 'ScheduleOccurrenceLinkConflictError';
	}
}

class ScheduleOccurrenceNotFoundError extends Error {
	constructor() {
		super('Occurrence was not found in this book');
		this.name = 'ScheduleOccurrenceNotFoundError';
	}
}

class ScheduleOccurrenceStatusInvalidError extends Error {
	constructor() {
		super('Schedule occurrence status is invalid');
		this.name = 'ScheduleOccurrenceStatusInvalidError';
	}
}

class ScheduleOccurrenceRecordInvalidError extends Error {
	constructor() {
		super('Schedule occurrence cannot be recorded with this ledger transaction');
		this.name = 'ScheduleOccurrenceRecordInvalidError';
	}
}

class ScheduleOccurrenceTransitionInvalidError extends Error {
	constructor(status: OccurrenceStatus) {
		super(`Cannot transition schedule occurrence from ${status}`);
		this.name = 'ScheduleOccurrenceTransitionInvalidError';
	}
}

export {
	ScheduleOccurrenceAmountInvalidError,
	ScheduleOccurrenceDateInvalidError,
	ScheduleOccurrenceGenerationLimitInvalidError,
	ScheduleOccurrenceGenerationThroughDateInvalidError,
	ScheduleOccurrenceIdentityInvalidError,
	ScheduleOccurrenceLedgerTransactionMismatchError,
	ScheduleOccurrenceLedgerTransactionNotFoundError,
	ScheduleOccurrenceLinkConflictError,
	ScheduleOccurrenceNotFoundError,
	ScheduleOccurrenceNumberInvalidError,
	ScheduleOccurrenceRecordInvalidError,
	ScheduleOccurrenceStatusInvalidError,
	ScheduleOccurrenceTransitionInvalidError,
	ScheduleOccurrenceUnavailableError,
};
