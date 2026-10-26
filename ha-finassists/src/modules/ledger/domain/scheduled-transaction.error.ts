class ScheduledTransactionAmountInvalidError extends Error {
	constructor() {
		super('amountMinor must be a positive safe integer');
	}
}

class ScheduledTransactionCurrencyInvalidError extends Error {
	constructor() {
		super('currencyCode must be a three-letter ISO 4217 code');
	}
}

class ScheduledTransactionDescriptionTooLongError extends Error {
	constructor(maxLength: number) {
		super(`description must be ${maxLength.toString()} characters or fewer`);
	}
}

class ScheduledTransactionKindInvalidError extends Error {
	constructor() {
		super('kind must be expense or income');
	}
}

class ScheduledTransactionFrequencyInvalidError extends Error {
	constructor() {
		super('frequency must be once, daily, weekly, monthly or yearly');
	}
}

class ScheduledTransactionIntervalInvalidError extends Error {
	constructor(maximum: number) {
		super(`interval must be a safe integer between 1 and ${maximum.toString()}`);
	}
}

class ScheduledTransactionStartDateInvalidError extends Error {
	constructor() {
		super('startDate must be a valid YYYY-MM-DD calendar date');
	}
}

class ScheduledTransactionEndDateInvalidError extends Error {
	constructor() {
		super('endDate must be a valid YYYY-MM-DD calendar date');
	}
}

class ScheduledTransactionDateRangeInvalidError extends Error {
	constructor() {
		super('endDate must be on or after startDate');
	}
}

class ScheduledTransactionPostingModeInvalidError extends Error {
	constructor() {
		super('postingMode must be automatic or manual');
	}
}

class ScheduledTransactionStatusInvalidError extends Error {
	constructor() {
		super('status must be active, paused or completed');
	}
}

class ScheduledTransactionStateInvalidError extends Error {
	constructor() {
		super('scheduled transaction state is inconsistent');
	}
}

class ScheduledTransactionProjectionRangeInvalidError extends Error {
	constructor() {
		super('projection range must contain valid calendar dates in ascending order');
	}
}

class ScheduledTransactionProjectionLimitInvalidError extends Error {
	constructor(maximum: number) {
		super(`projection limit must be a safe integer between 1 and ${maximum.toString()}`);
	}
}

class ScheduledTransactionNotFoundError extends Error {
	constructor(id: string) {
		super(`scheduled transaction ${id} not found`);
	}
}

class ScheduledTransactionCompletedError extends Error {
	constructor(id: string) {
		super(`scheduled transaction ${id} cannot be changed because it is completed`);
	}
}

class ScheduledTransactionTransitionError extends Error {
	constructor(action: string, status: string) {
		super(`scheduled transaction cannot ${action} while it is ${status}`);
	}
}

class ScheduledTransactionNotDueError extends Error {
	constructor(id: string, dueDate: null | string) {
		super(
			dueDate === null
				? `scheduled transaction ${id} cannot be posted because it has no next occurrence`
				: `scheduled transaction ${id} cannot be posted before ${dueDate}`
		);
	}
}

class ScheduledTransactionVersionConflictError extends Error {
	constructor(id: string) {
		super(`scheduled transaction ${id} cannot be updated because it changed; reload and try again`);
	}
}

export {
	ScheduledTransactionAmountInvalidError,
	ScheduledTransactionCompletedError,
	ScheduledTransactionCurrencyInvalidError,
	ScheduledTransactionDateRangeInvalidError,
	ScheduledTransactionDescriptionTooLongError,
	ScheduledTransactionEndDateInvalidError,
	ScheduledTransactionFrequencyInvalidError,
	ScheduledTransactionIntervalInvalidError,
	ScheduledTransactionKindInvalidError,
	ScheduledTransactionNotDueError,
	ScheduledTransactionNotFoundError,
	ScheduledTransactionPostingModeInvalidError,
	ScheduledTransactionProjectionLimitInvalidError,
	ScheduledTransactionProjectionRangeInvalidError,
	ScheduledTransactionStartDateInvalidError,
	ScheduledTransactionStateInvalidError,
	ScheduledTransactionStatusInvalidError,
	ScheduledTransactionTransitionError,
	ScheduledTransactionVersionConflictError,
};
