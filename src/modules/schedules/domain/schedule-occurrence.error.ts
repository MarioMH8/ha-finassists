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
	ScheduleOccurrenceIdentityInvalidError,
	ScheduleOccurrenceNumberInvalidError,
	ScheduleOccurrenceRecordInvalidError,
	ScheduleOccurrenceStatusInvalidError,
	ScheduleOccurrenceTransitionInvalidError,
	ScheduleOccurrenceUnavailableError,
};
