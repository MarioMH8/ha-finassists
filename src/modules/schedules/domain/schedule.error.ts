class ScheduleAfterDateInvalidError extends Error {
	constructor() {
		super('After date must be a valid YYYY-MM-DD calendar date');
		this.name = 'ScheduleAfterDateInvalidError';
	}
}

class ScheduleAmountInvalidError extends Error {
	constructor() {
		super('Schedule amount must be a non-zero safe integer number of minor units');
		this.name = 'ScheduleAmountInvalidError';
	}
}

class ScheduleDateRangeInvalidError extends Error {
	constructor() {
		super('Schedule end date must not be before its start date');
		this.name = 'ScheduleDateRangeInvalidError';
	}
}

class ScheduleEndDateInvalidError extends Error {
	constructor() {
		super('Schedule end date must be a valid YYYY-MM-DD calendar date');
		this.name = 'ScheduleEndDateInvalidError';
	}
}

class ScheduleFrequencyInvalidError extends Error {
	constructor() {
		super('Schedule frequency is not supported');
		this.name = 'ScheduleFrequencyInvalidError';
	}
}

class ScheduleIdentityInvalidError extends Error {
	constructor() {
		super('Schedule id, book id, and account id must not be empty');
		this.name = 'ScheduleIdentityInvalidError';
	}
}

class ScheduleIntervalInvalidError extends Error {
	constructor() {
		super('Schedule interval must be a positive safe integer');
		this.name = 'ScheduleIntervalInvalidError';
	}
}

class ScheduleOneTimeIntervalInvalidError extends Error {
	constructor() {
		super('One-time schedules must have an interval of one');
		this.name = 'ScheduleOneTimeIntervalInvalidError';
	}
}

class ScheduleOccurrenceLimitInvalidError extends Error {
	constructor() {
		super('Occurrence limit must be a positive safe integer and match the schedule frequency');
		this.name = 'ScheduleOccurrenceLimitInvalidError';
	}
}

class ScheduleOccurrenceNumberInvalidError extends Error {
	constructor() {
		super('Occurrence number must be a non-negative safe integer');
		this.name = 'ScheduleOccurrenceNumberInvalidError';
	}
}

class ScheduleStatusInvalidError extends Error {
	constructor() {
		super('Schedule status is not supported');
		this.name = 'ScheduleStatusInvalidError';
	}
}

class ScheduleStartDateInvalidError extends Error {
	constructor() {
		super('Schedule start date must be a valid YYYY-MM-DD calendar date');
		this.name = 'ScheduleStartDateInvalidError';
	}
}

class ScheduleTextInvalidError extends Error {
	constructor() {
		super('Schedule payee or memo exceeds its maximum length');
		this.name = 'ScheduleTextInvalidError';
	}
}

class ScheduleTransitionInvalidError extends Error {
	constructor(from: string, to: string) {
		super(`Cannot transition a ${from} schedule to ${to}`);
		this.name = 'ScheduleTransitionInvalidError';
	}
}

export {
	ScheduleAfterDateInvalidError,
	ScheduleAmountInvalidError,
	ScheduleDateRangeInvalidError,
	ScheduleEndDateInvalidError,
	ScheduleFrequencyInvalidError,
	ScheduleIdentityInvalidError,
	ScheduleIntervalInvalidError,
	ScheduleOccurrenceLimitInvalidError,
	ScheduleOccurrenceNumberInvalidError,
	ScheduleOneTimeIntervalInvalidError,
	ScheduleStartDateInvalidError,
	ScheduleStatusInvalidError,
	ScheduleTextInvalidError,
	ScheduleTransitionInvalidError,
};
