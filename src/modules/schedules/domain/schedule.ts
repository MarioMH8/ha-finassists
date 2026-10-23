const SCHEDULE_FREQUENCY = {
	DAILY: 'daily',
	MONTHLY: 'monthly',
	ONE_TIME: 'one_time',
	QUARTERLY: 'quarterly',
	WEEKLY: 'weekly',
	YEARLY: 'yearly',
} as const;

type ScheduleFrequency = (typeof SCHEDULE_FREQUENCY)[keyof typeof SCHEDULE_FREQUENCY];

interface ScheduledPayment {
	accountId: string;
	amountMinor: number;
	bookId: string;
	createdAt: string;
	endDate?: string;
	frequency: ScheduleFrequency;
	id: string;
	interval: number;
	memo: string;
	occurrenceLimit?: number;
	payee: string;
	startDate: string;
	status: ScheduleStatus;
}

const SCHEDULE_STATUS = {
	ACTIVE: 'active',
	CANCELED: 'canceled',
	COMPLETED: 'completed',
	PAUSED: 'paused',
} as const;

type ScheduleStatus = (typeof SCHEDULE_STATUS)[keyof typeof SCHEDULE_STATUS];

interface CreateScheduledPaymentInput {
	accountId: string;
	amountMinor: number;
	bookId: string;
	endDate?: string;
	frequency: ScheduleFrequency;
	id: string;
	interval?: number;
	memo?: string;
	occurrenceLimit?: number;
	payee?: string;
	startDate: string;
}

interface UpdateScheduledPaymentInput {
	amountMinor?: number;
	endDate?: string;
	memo?: string;
	occurrenceLimit?: number;
	payee?: string;
}

function createScheduledPayment(
	input: CreateScheduledPaymentInput,
	createdAt = new Date().toISOString()
): ScheduledPayment {
	const schedule: ScheduledPayment = {
		accountId: input.accountId,
		amountMinor: input.amountMinor,
		bookId: input.bookId,
		createdAt,
		endDate: input.endDate,
		frequency: input.frequency,
		id: input.id,
		interval: input.interval ?? 1,
		memo: input.memo?.trim() ?? '',
		occurrenceLimit: input.occurrenceLimit ?? (input.frequency === SCHEDULE_FREQUENCY.ONE_TIME ? 1 : undefined),
		payee: input.payee?.trim() ?? '',
		startDate: input.startDate,
		status: SCHEDULE_STATUS.ACTIVE,
	};
	validateScheduledPayment(schedule);

	return schedule;
}

function updateScheduledPayment(schedule: ScheduledPayment, changes: UpdateScheduledPaymentInput): ScheduledPayment {
	const updated = { ...schedule, ...changes };
	validateScheduledPayment(updated);

	return updated;
}

function transitionScheduleStatus(schedule: ScheduledPayment, status: ScheduleStatus): ScheduledPayment {
	const allowedTransitions: Record<ScheduleStatus, ScheduleStatus[]> = {
		[SCHEDULE_STATUS.ACTIVE]: [SCHEDULE_STATUS.PAUSED, SCHEDULE_STATUS.CANCELED],
		[SCHEDULE_STATUS.CANCELED]: [],
		[SCHEDULE_STATUS.COMPLETED]: [],
		[SCHEDULE_STATUS.PAUSED]: [SCHEDULE_STATUS.ACTIVE, SCHEDULE_STATUS.CANCELED],
	};
	if (!allowedTransitions[schedule.status].includes(status)) {
		throw new Error(`Cannot transition a ${schedule.status} schedule to ${status}`);
	}

	return { ...schedule, status };
}

function dueDateAtOccurrence(schedule: ScheduledPayment, occurrenceNumber: number): string | undefined {
	if (!Number.isSafeInteger(occurrenceNumber) || occurrenceNumber < 0) {
		throw new Error('Occurrence number must be a non-negative safe integer');
	}
	if (schedule.frequency === SCHEDULE_FREQUENCY.ONE_TIME && occurrenceNumber > 0) {
		return undefined;
	}
	if (schedule.occurrenceLimit !== undefined && occurrenceNumber >= schedule.occurrenceLimit) {
		return undefined;
	}

	const start = parseCalendarDate(schedule.startDate);
	if (!start) {
		throw new Error('Schedule start date must be a valid YYYY-MM-DD calendar date');
	}
	const step = occurrenceNumber * schedule.interval;
	let dueDate: string | undefined;

	switch (schedule.frequency) {
		case SCHEDULE_FREQUENCY.DAILY: {
			dueDate = addDays(schedule.startDate, step);
			break;
		}
		case SCHEDULE_FREQUENCY.MONTHLY: {
			dueDate = addMonths(start.year, start.month, start.day, step);
			break;
		}
		case SCHEDULE_FREQUENCY.ONE_TIME: {
			dueDate = schedule.startDate;
			break;
		}
		case SCHEDULE_FREQUENCY.QUARTERLY: {
			dueDate = addMonths(start.year, start.month, start.day, step * 3);
			break;
		}
		case SCHEDULE_FREQUENCY.WEEKLY: {
			dueDate = addDays(schedule.startDate, step * 7);
			break;
		}
		case SCHEDULE_FREQUENCY.YEARLY: {
			dueDate = addYear(start.year, start.month, start.day, step);
			break;
		}
	}

	return dueDate !== undefined && schedule.endDate !== undefined && dueDate > schedule.endDate ? undefined : dueDate;
}

function nextDueDate(schedule: ScheduledPayment, afterDate?: string, occurrenceNumber = 0): string | undefined {
	if (afterDate !== undefined && !parseCalendarDate(afterDate)) {
		throw new Error('After date must be a valid YYYY-MM-DD calendar date');
	}

	let index =
		afterDate === undefined
			? occurrenceNumber
			: Math.max(occurrenceNumber, estimateOccurrenceIndex(schedule, afterDate));
	while (Number.isSafeInteger(index)) {
		const dueDate = dueDateAtOccurrence(schedule, index);
		if (dueDate === undefined) {
			return undefined;
		}
		if (afterDate === undefined || dueDate > afterDate) {
			return dueDate;
		}
		index += 1;
	}

	return undefined;
}

function estimateOccurrenceIndex(schedule: ScheduledPayment, afterDate: string): number {
	if (afterDate < schedule.startDate || schedule.frequency === SCHEDULE_FREQUENCY.ONE_TIME) {
		return 0;
	}
	const start = parseCalendarDate(schedule.startDate);
	const after = parseCalendarDate(afterDate);
	if (!start || !after) {
		return 0;
	}

	let estimate: number;
	switch (schedule.frequency) {
		case SCHEDULE_FREQUENCY.DAILY:
		case SCHEDULE_FREQUENCY.WEEKLY: {
			const differenceDays =
				(new Date(`${afterDate}T00:00:00.000Z`).getTime() -
					new Date(`${schedule.startDate}T00:00:00.000Z`).getTime()) /
				86_400_000;
			const intervalDays = schedule.interval * (schedule.frequency === SCHEDULE_FREQUENCY.WEEKLY ? 7 : 1);
			estimate = Math.floor(differenceDays / intervalDays);
			break;
		}
		case SCHEDULE_FREQUENCY.MONTHLY:
		case SCHEDULE_FREQUENCY.QUARTERLY: {
			const differenceMonths = (after.year - start.year) * 12 + after.month - start.month;
			const intervalMonths = schedule.interval * (schedule.frequency === SCHEDULE_FREQUENCY.QUARTERLY ? 3 : 1);
			estimate = Math.floor(differenceMonths / intervalMonths);
			break;
		}
		case SCHEDULE_FREQUENCY.YEARLY: {
			estimate = Math.floor((after.year - start.year) / schedule.interval);
			break;
		}
	}

	return Number.isSafeInteger(estimate) ? Math.max(0, estimate) : Number.MAX_SAFE_INTEGER;
}

function validateScheduledPayment(schedule: ScheduledPayment): void {
	if (!schedule.id.trim() || !schedule.bookId.trim() || !schedule.accountId.trim()) {
		throw new Error('Schedule id, book id, and account id must not be empty');
	}
	if (!Object.values(SCHEDULE_FREQUENCY).includes(schedule.frequency)) {
		throw new Error('Schedule frequency is not supported');
	}
	if (!Object.values(SCHEDULE_STATUS).includes(schedule.status)) {
		throw new Error('Schedule status is not supported');
	}
	if (!Number.isSafeInteger(schedule.amountMinor) || schedule.amountMinor === 0) {
		throw new Error('Schedule amount must be a non-zero safe integer number of minor units');
	}
	if (!Number.isSafeInteger(schedule.interval) || schedule.interval < 1) {
		throw new Error('Schedule interval must be a positive safe integer');
	}
	if (schedule.frequency === SCHEDULE_FREQUENCY.ONE_TIME && schedule.interval !== 1) {
		throw new Error('One-time schedules must have an interval of one');
	}
	if (
		schedule.occurrenceLimit !== undefined &&
		(!Number.isSafeInteger(schedule.occurrenceLimit) || schedule.occurrenceLimit < 1)
	) {
		throw new Error('Occurrence limit must be a positive safe integer');
	}
	if (schedule.frequency === SCHEDULE_FREQUENCY.ONE_TIME && schedule.occurrenceLimit !== 1) {
		throw new Error('One-time schedules must have exactly one occurrence');
	}
	if (schedule.payee.length > 120 || schedule.memo.length > 500) {
		throw new Error('Schedule payee or memo exceeds its maximum length');
	}
	if (!parseCalendarDate(schedule.startDate)) {
		throw new Error('Schedule start date must be a valid YYYY-MM-DD calendar date');
	}
	if (schedule.endDate !== undefined) {
		if (!parseCalendarDate(schedule.endDate)) {
			throw new Error('Schedule end date must be a valid YYYY-MM-DD calendar date');
		}
		if (schedule.endDate < schedule.startDate) {
			throw new Error('Schedule end date must not be before its start date');
		}
	}
}

function parseCalendarDate(value: string): undefined | { day: number; month: number; year: number } {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return undefined;
	}
	const year = Number(value.slice(0, 4));
	const month = Number(value.slice(5, 7));
	const day = Number(value.slice(8, 10));
	if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
		return undefined;
	}

	return { day, month, year };
}

function daysInMonth(year: number, month: number): number {
	if (month === 2) {
		return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
	}

	return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function addDays(date: string, amount: number): string | undefined {
	if (!Number.isSafeInteger(amount)) {
		return undefined;
	}
	const value = new Date(`${date}T00:00:00.000Z`);
	value.setUTCDate(value.getUTCDate() + amount);
	if (Number.isNaN(value.getTime()) || value.getUTCFullYear() > 9999) {
		return undefined;
	}

	return value.toISOString().slice(0, 10);
}

function addMonths(year: number, month: number, day: number, amount: number): string | undefined {
	if (!Number.isSafeInteger(amount)) {
		return undefined;
	}
	const total = year * 12 + month - 1 + amount;
	if (!Number.isSafeInteger(total)) {
		return undefined;
	}
	const nextYear = Math.floor(total / 12);
	if (nextYear > 9999) {
		return undefined;
	}
	const nextMonth = (total % 12) + 1;

	return formatCalendarDate(nextYear, nextMonth, Math.min(day, daysInMonth(nextYear, nextMonth)));
}

function addYear(year: number, month: number, day: number, amount: number): string | undefined {
	const nextYear = year + amount;
	if (!Number.isSafeInteger(nextYear) || nextYear > 9999) {
		return undefined;
	}

	return formatCalendarDate(nextYear, month, Math.min(day, daysInMonth(nextYear, month)));
}

function formatCalendarDate(year: number, month: number, day: number): string {
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export {
	createScheduledPayment,
	type CreateScheduledPaymentInput,
	dueDateAtOccurrence,
	nextDueDate,
	SCHEDULE_FREQUENCY,
	SCHEDULE_STATUS,
	type ScheduledPayment,
	type ScheduleFrequency,
	type ScheduleStatus,
	transitionScheduleStatus,
	updateScheduledPayment,
	type UpdateScheduledPaymentInput,
	validateScheduledPayment,
};
