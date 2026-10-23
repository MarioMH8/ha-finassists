import {
	ScheduleAfterDateInvalidError,
	ScheduleAmountInvalidError,
	ScheduleDateRangeInvalidError,
	ScheduleEndDateInvalidError,
	ScheduleFrequencyInvalidError,
	ScheduleIdentityInvalidError,
	ScheduleIntervalInvalidError,
	ScheduleOccurrenceLimitInvalidError,
	ScheduleOneTimeIntervalInvalidError,
	ScheduleStartDateInvalidError,
	ScheduleStatusInvalidError,
	ScheduleTextInvalidError,
	ScheduleTransitionInvalidError,
} from './schedule.error';
import { ScheduleOccurrenceNumberInvalidError } from './schedule-occurrence.error';

const SCHEDULE_FREQUENCY = {
	DAILY: 'daily',
	MONTHLY: 'monthly',
	ONE_TIME: 'one_time',
	QUARTERLY: 'quarterly',
	WEEKLY: 'weekly',
	YEARLY: 'yearly',
} as const;

type ScheduleFrequency = (typeof SCHEDULE_FREQUENCY)[keyof typeof SCHEDULE_FREQUENCY];

interface ScheduledPaymentProperties {
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

class ScheduledPayment {
	readonly accountId: string;
	readonly amountMinor: number;
	readonly bookId: string;
	readonly createdAt: string;
	readonly endDate?: string;
	readonly frequency: ScheduleFrequency;
	readonly id: string;
	readonly interval: number;
	readonly memo: string;
	readonly occurrenceLimit?: number;
	readonly payee: string;
	readonly startDate: string;
	readonly status: ScheduleStatus;

	private constructor(properties: ScheduledPaymentProperties) {
		this.accountId = properties.accountId;
		this.amountMinor = properties.amountMinor;
		this.bookId = properties.bookId;
		this.createdAt = properties.createdAt;
		this.endDate = properties.endDate;
		this.frequency = properties.frequency;
		this.id = properties.id;
		this.interval = properties.interval;
		this.memo = properties.memo;
		this.occurrenceLimit = properties.occurrenceLimit;
		this.payee = properties.payee;
		this.startDate = properties.startDate;
		this.status = properties.status;
	}

	static create(input: CreateScheduledPaymentInput, createdAt = new Date().toISOString()): ScheduledPayment {
		return this.restore({
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
		});
	}

	static restore(properties: ScheduledPaymentProperties): ScheduledPayment {
		const schedule = new this(properties);
		this.validate(schedule);

		return schedule;
	}

	private static validate(schedule: ScheduledPayment): void {
		if (!schedule.id.trim() || !schedule.bookId.trim() || !schedule.accountId.trim()) {
			throw new ScheduleIdentityInvalidError();
		}
		if (!Object.values(SCHEDULE_FREQUENCY).includes(schedule.frequency)) {
			throw new ScheduleFrequencyInvalidError();
		}
		if (!Object.values(SCHEDULE_STATUS).includes(schedule.status)) {
			throw new ScheduleStatusInvalidError();
		}
		if (!Number.isSafeInteger(schedule.amountMinor) || schedule.amountMinor === 0) {
			throw new ScheduleAmountInvalidError();
		}
		if (!Number.isSafeInteger(schedule.interval) || schedule.interval < 1) {
			throw new ScheduleIntervalInvalidError();
		}
		if (schedule.frequency === SCHEDULE_FREQUENCY.ONE_TIME && schedule.interval !== 1) {
			throw new ScheduleOneTimeIntervalInvalidError();
		}
		if (
			schedule.occurrenceLimit !== undefined &&
			(!Number.isSafeInteger(schedule.occurrenceLimit) || schedule.occurrenceLimit < 1)
		) {
			throw new ScheduleOccurrenceLimitInvalidError();
		}
		if (schedule.frequency === SCHEDULE_FREQUENCY.ONE_TIME && schedule.occurrenceLimit !== 1) {
			throw new ScheduleOccurrenceLimitInvalidError();
		}
		if (schedule.payee.length > 120 || schedule.memo.length > 500) {
			throw new ScheduleTextInvalidError();
		}
		if (!parseCalendarDate(schedule.startDate)) {
			throw new ScheduleStartDateInvalidError();
		}
		if (schedule.endDate !== undefined) {
			if (!parseCalendarDate(schedule.endDate)) {
				throw new ScheduleEndDateInvalidError();
			}
			if (schedule.endDate < schedule.startDate) {
				throw new ScheduleDateRangeInvalidError();
			}
		}
	}

	dueDateAtOccurrence(occurrenceNumber: number): string | undefined {
		if (!Number.isSafeInteger(occurrenceNumber) || occurrenceNumber < 0) {
			throw new ScheduleOccurrenceNumberInvalidError();
		}
		if (this.frequency === SCHEDULE_FREQUENCY.ONE_TIME && occurrenceNumber > 0) {
			return undefined;
		}
		if (this.occurrenceLimit !== undefined && occurrenceNumber >= this.occurrenceLimit) {
			return undefined;
		}

		const start = parseCalendarDate(this.startDate);
		if (!start) {
			throw new ScheduleStartDateInvalidError();
		}
		const step = occurrenceNumber * this.interval;
		let dueDate: string | undefined;

		switch (this.frequency) {
			case SCHEDULE_FREQUENCY.DAILY: {
				dueDate = addDays(this.startDate, step);
				break;
			}
			case SCHEDULE_FREQUENCY.MONTHLY: {
				dueDate = addMonths(start.year, start.month, start.day, step);
				break;
			}
			case SCHEDULE_FREQUENCY.ONE_TIME: {
				dueDate = this.startDate;
				break;
			}
			case SCHEDULE_FREQUENCY.QUARTERLY: {
				dueDate = addMonths(start.year, start.month, start.day, step * 3);
				break;
			}
			case SCHEDULE_FREQUENCY.WEEKLY: {
				dueDate = addDays(this.startDate, step * 7);
				break;
			}
			case SCHEDULE_FREQUENCY.YEARLY: {
				dueDate = addYear(start.year, start.month, start.day, step);
				break;
			}
		}

		return dueDate !== undefined && this.endDate !== undefined && dueDate > this.endDate ? undefined : dueDate;
	}

	nextDueDate(afterDate?: string, occurrenceNumber = 0): string | undefined {
		if (afterDate !== undefined && !parseCalendarDate(afterDate)) {
			throw new ScheduleAfterDateInvalidError();
		}

		let index =
			afterDate === undefined
				? occurrenceNumber
				: Math.max(occurrenceNumber, this.estimateOccurrenceIndex(afterDate));
		while (Number.isSafeInteger(index)) {
			const dueDate = this.dueDateAtOccurrence(index);
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

	transitionTo(status: ScheduleStatus): ScheduledPayment {
		const allowedTransitions: Record<ScheduleStatus, ScheduleStatus[]> = {
			[SCHEDULE_STATUS.ACTIVE]: [SCHEDULE_STATUS.PAUSED, SCHEDULE_STATUS.CANCELED, SCHEDULE_STATUS.COMPLETED],
			[SCHEDULE_STATUS.CANCELED]: [],
			[SCHEDULE_STATUS.COMPLETED]: [],
			[SCHEDULE_STATUS.PAUSED]: [SCHEDULE_STATUS.ACTIVE, SCHEDULE_STATUS.CANCELED],
		};
		if (!allowedTransitions[this.status].includes(status)) {
			throw new ScheduleTransitionInvalidError(this.status, status);
		}

		return this.with({ status });
	}

	update(changes: UpdateScheduledPaymentInput): ScheduledPayment {
		return this.with(changes);
	}

	private estimateOccurrenceIndex(afterDate: string): number {
		if (afterDate < this.startDate || this.frequency === SCHEDULE_FREQUENCY.ONE_TIME) {
			return 0;
		}
		const start = parseCalendarDate(this.startDate);
		const after = parseCalendarDate(afterDate);
		if (!start || !after) {
			return 0;
		}

		let estimate: number;
		switch (this.frequency) {
			case SCHEDULE_FREQUENCY.DAILY:
			case SCHEDULE_FREQUENCY.WEEKLY: {
				const differenceDays =
					(new Date(`${afterDate}T00:00:00.000Z`).getTime() -
						new Date(`${this.startDate}T00:00:00.000Z`).getTime()) /
					86_400_000;
				const intervalDays = this.interval * (this.frequency === SCHEDULE_FREQUENCY.WEEKLY ? 7 : 1);
				estimate = Math.floor(differenceDays / intervalDays);
				break;
			}
			case SCHEDULE_FREQUENCY.MONTHLY:
			case SCHEDULE_FREQUENCY.QUARTERLY: {
				const differenceMonths = (after.year - start.year) * 12 + after.month - start.month;
				const intervalMonths = this.interval * (this.frequency === SCHEDULE_FREQUENCY.QUARTERLY ? 3 : 1);
				estimate = Math.floor(differenceMonths / intervalMonths);
				break;
			}
			case SCHEDULE_FREQUENCY.YEARLY: {
				estimate = Math.floor((after.year - start.year) / this.interval);
				break;
			}
		}

		return Number.isSafeInteger(estimate) ? Math.max(0, estimate) : Number.MAX_SAFE_INTEGER;
	}

	private with(changes: Partial<ScheduledPaymentProperties>): ScheduledPayment {
		const updated = new ScheduledPayment({
			accountId: this.accountId,
			amountMinor: this.amountMinor,
			bookId: this.bookId,
			createdAt: this.createdAt,
			endDate: this.endDate,
			frequency: this.frequency,
			id: this.id,
			interval: this.interval,
			memo: this.memo,
			occurrenceLimit: this.occurrenceLimit,
			payee: this.payee,
			startDate: this.startDate,
			status: this.status,
			...changes,
		});
		ScheduledPayment.validate(updated);

		return updated;
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

export { SCHEDULE_FREQUENCY, SCHEDULE_STATUS, ScheduledPayment };
export type { CreateScheduledPaymentInput, ScheduleFrequency, ScheduleStatus, UpdateScheduledPaymentInput };
