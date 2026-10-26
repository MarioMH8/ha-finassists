import { CalendarDate } from './calendar-date';
import {
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
	ScheduledTransactionPostingModeInvalidError,
	ScheduledTransactionProjectionLimitInvalidError,
	ScheduledTransactionProjectionRangeInvalidError,
	ScheduledTransactionStartDateInvalidError,
	ScheduledTransactionStateInvalidError,
	ScheduledTransactionStatusInvalidError,
	ScheduledTransactionTransitionError,
} from './scheduled-transaction.error';
import type { TransactionKind } from './transaction';
import { DESCRIPTION_MAX_LENGTH, Transaction } from './transaction';

const SCHEDULED_TRANSACTION_FREQUENCY = {
	DAILY: 'daily',
	MONTHLY: 'monthly',
	ONCE: 'once',
	WEEKLY: 'weekly',
	YEARLY: 'yearly',
} as const;

type ScheduledTransactionFrequency =
	(typeof SCHEDULED_TRANSACTION_FREQUENCY)[keyof typeof SCHEDULED_TRANSACTION_FREQUENCY];

const SCHEDULED_TRANSACTION_FREQUENCIES: readonly ScheduledTransactionFrequency[] = Object.values(
	SCHEDULED_TRANSACTION_FREQUENCY
);

const SCHEDULED_TRANSACTION_STATUS = {
	ACTIVE: 'active',
	COMPLETED: 'completed',
	PAUSED: 'paused',
} as const;

type ScheduledTransactionStatus = (typeof SCHEDULED_TRANSACTION_STATUS)[keyof typeof SCHEDULED_TRANSACTION_STATUS];

const SCHEDULED_TRANSACTION_STATUSES: readonly ScheduledTransactionStatus[] =
	Object.values(SCHEDULED_TRANSACTION_STATUS);

const SCHEDULED_TRANSACTION_POSTING_MODE = {
	AUTOMATIC: 'automatic',
	MANUAL: 'manual',
} as const;

type ScheduledTransactionPostingMode =
	(typeof SCHEDULED_TRANSACTION_POSTING_MODE)[keyof typeof SCHEDULED_TRANSACTION_POSTING_MODE];

const SCHEDULED_TRANSACTION_POSTING_MODES: readonly ScheduledTransactionPostingMode[] = Object.values(
	SCHEDULED_TRANSACTION_POSTING_MODE
);

const SCHEDULED_TRANSACTION_INTERVAL_MAX = 999;
const SCHEDULED_TRANSACTION_MAX_PROJECTED_OCCURRENCES = 1000;

interface ScheduledTransactionProperties {
	amountMinor: number;
	categoryId: null | string;
	createdAt: string;
	createdBy: null | string;
	currencyCode: string;
	description: string;
	endDate: null | string;
	frequency: ScheduledTransactionFrequency;
	id: string;
	interval: number;
	kind: TransactionKind;
	nextDueDate: null | string;
	occurrenceNumber: number;
	postingMode: ScheduledTransactionPostingMode;
	startDate: string;
	status: ScheduledTransactionStatus;
	version: number;
}

interface CreateScheduledTransactionProperties {
	amountMinor: number;
	categoryId?: null | string;
	createdAt: string;
	createdBy?: null | string;
	currencyCode: string;
	description?: string;
	endDate?: null | string;
	frequency: ScheduledTransactionFrequency;
	id: string;
	interval?: number;
	kind: TransactionKind;
	postingMode?: ScheduledTransactionPostingMode;
	startDate: string;
}

interface ScheduledTransactionChanges {
	amountMinor?: number;
	categoryId?: null | string;
	description?: string;
	endDate?: null | string;
	frequency?: ScheduledTransactionFrequency;
	interval?: number;
	kind?: TransactionKind;
	postingMode?: ScheduledTransactionPostingMode;
	startDate?: string;
}

interface ScheduledOccurrence {
	dueDate: string;
	occurrenceNumber: number;
}

class ScheduledTransaction {
	private constructor(
		readonly id: string,
		readonly kind: TransactionKind,
		readonly amountMinor: number,
		readonly currencyCode: string,
		readonly description: string,
		readonly categoryId: null | string,
		readonly startDate: string,
		readonly frequency: ScheduledTransactionFrequency,
		readonly interval: number,
		readonly endDate: null | string,
		readonly nextDueDate: null | string,
		readonly occurrenceNumber: number,
		readonly postingMode: ScheduledTransactionPostingMode,
		readonly status: ScheduledTransactionStatus,
		readonly createdBy: null | string,
		readonly createdAt: string,
		readonly version: number
	) {}

	static create(properties: CreateScheduledTransactionProperties): ScheduledTransaction {
		const base = this.createInstance({
			amountMinor: properties.amountMinor,
			categoryId: properties.categoryId ?? null,
			createdAt: properties.createdAt,
			createdBy: properties.createdBy ?? null,
			currencyCode: properties.currencyCode,
			description: properties.description ?? '',
			endDate: properties.endDate ?? null,
			frequency: properties.frequency,
			id: properties.id,
			interval: properties.interval ?? 1,
			kind: properties.kind,
			nextDueDate: null,
			occurrenceNumber: 0,
			postingMode: properties.postingMode ?? SCHEDULED_TRANSACTION_POSTING_MODE.AUTOMATIC,
			startDate: properties.startDate,
			status: SCHEDULED_TRANSACTION_STATUS.COMPLETED,
			version: 0,
		});
		const nextDueDate = this.dueDateAtOccurrence(base, 0);
		if (nextDueDate === undefined) {
			throw new ScheduledTransactionDateRangeInvalidError();
		}

		return this.restore({
			...base.toProperties(),
			nextDueDate,
			occurrenceNumber: 0,
			status: SCHEDULED_TRANSACTION_STATUS.ACTIVE,
		});
	}

	static isFrequency(value: string): value is ScheduledTransactionFrequency {
		return (SCHEDULED_TRANSACTION_FREQUENCIES as readonly string[]).includes(value);
	}

	static isPostingMode(value: string): value is ScheduledTransactionPostingMode {
		return (SCHEDULED_TRANSACTION_POSTING_MODES as readonly string[]).includes(value);
	}

	static isStatus(value: string): value is ScheduledTransactionStatus {
		return (SCHEDULED_TRANSACTION_STATUSES as readonly string[]).includes(value);
	}

	static restore(properties: ScheduledTransactionProperties): ScheduledTransaction {
		const schedule = this.createInstance(properties);
		this.validateState(schedule);

		return schedule;
	}

	private static createInstance(properties: ScheduledTransactionProperties): ScheduledTransaction {
		const frequency = properties.frequency;
		const interval = frequency === SCHEDULED_TRANSACTION_FREQUENCY.ONCE ? 1 : properties.interval;
		const endDate = frequency === SCHEDULED_TRANSACTION_FREQUENCY.ONCE ? null : properties.endDate;
		const schedule = new ScheduledTransaction(
			properties.id,
			properties.kind,
			properties.amountMinor,
			properties.currencyCode,
			properties.description.trim(),
			properties.categoryId,
			properties.startDate,
			frequency,
			interval,
			endDate,
			properties.nextDueDate,
			properties.occurrenceNumber,
			properties.postingMode,
			properties.status,
			properties.createdBy,
			properties.createdAt,
			properties.version
		);
		this.validateDefinition(schedule);

		return schedule;
	}

	private static dueDateAtOccurrence(schedule: ScheduledTransaction, occurrenceNumber: number): string | undefined {
		if (!Number.isSafeInteger(occurrenceNumber) || occurrenceNumber < 0) {
			return undefined;
		}
		if (schedule.frequency === SCHEDULED_TRANSACTION_FREQUENCY.ONCE) {
			return occurrenceNumber === 0 ? schedule.startDate : undefined;
		}
		const step = occurrenceNumber * schedule.interval;
		if (!Number.isSafeInteger(step)) {
			return undefined;
		}
		let dueDate: string | undefined;
		switch (schedule.frequency) {
			case SCHEDULED_TRANSACTION_FREQUENCY.DAILY: {
				dueDate = CalendarDate.addDays(schedule.startDate, step);
				break;
			}
			case SCHEDULED_TRANSACTION_FREQUENCY.MONTHLY: {
				dueDate = CalendarDate.addMonths(schedule.startDate, step);
				break;
			}
			case SCHEDULED_TRANSACTION_FREQUENCY.WEEKLY: {
				dueDate = CalendarDate.addDays(schedule.startDate, step * 7);
				break;
			}
			case SCHEDULED_TRANSACTION_FREQUENCY.YEARLY: {
				dueDate = CalendarDate.addYears(schedule.startDate, step);
				break;
			}
		}
		if (dueDate === undefined) {
			return undefined;
		}

		return schedule.endDate !== null && dueDate > schedule.endDate ? undefined : dueDate;
	}

	private static firstOccurrenceOnOrAfter(
		schedule: ScheduledTransaction,
		date: string,
		minimumIndex: number
	): ScheduledOccurrence | undefined {
		const occurrenceNumber = this.occurrenceIndexOnOrAfter(schedule, date, minimumIndex);
		if (occurrenceNumber === undefined) {
			return undefined;
		}
		const dueDate = this.dueDateAtOccurrence(schedule, occurrenceNumber);

		return dueDate === undefined ? undefined : { dueDate, occurrenceNumber };
	}

	private static occurrenceIndexOnOrAfter(
		schedule: ScheduledTransaction,
		date: string,
		minimumIndex: number
	): number | undefined {
		if (!CalendarDate.isValid(date) || !Number.isSafeInteger(minimumIndex) || minimumIndex < 0) {
			return undefined;
		}
		if (schedule.frequency === SCHEDULED_TRANSACTION_FREQUENCY.ONCE) {
			return minimumIndex === 0 && schedule.startDate >= date ? 0 : undefined;
		}
		const start = CalendarDate.parse(schedule.startDate);
		const target = CalendarDate.parse(date);
		if (start === undefined || target === undefined) {
			return undefined;
		}
		let estimate = 0;
		switch (schedule.frequency) {
			case SCHEDULED_TRANSACTION_FREQUENCY.DAILY: {
				const difference = CalendarDate.daysBetween(schedule.startDate, date) ?? 0;
				estimate = Math.ceil(difference / schedule.interval);
				break;
			}
			case SCHEDULED_TRANSACTION_FREQUENCY.MONTHLY: {
				const difference = (target.year - start.year) * 12 + target.month - start.month;
				estimate = Math.ceil(difference / schedule.interval);
				break;
			}
			case SCHEDULED_TRANSACTION_FREQUENCY.WEEKLY: {
				const difference = CalendarDate.daysBetween(schedule.startDate, date) ?? 0;
				estimate = Math.ceil(difference / (schedule.interval * 7));
				break;
			}
			case SCHEDULED_TRANSACTION_FREQUENCY.YEARLY: {
				const difference = target.year - start.year;
				estimate = Math.ceil(difference / schedule.interval);
				break;
			}
		}
		let index = Math.max(0, minimumIndex, estimate);
		let dueDate = this.dueDateAtOccurrence(schedule, index);
		while (dueDate !== undefined && dueDate < date) {
			index += 1;
			dueDate = this.dueDateAtOccurrence(schedule, index);
		}
		while (index > minimumIndex) {
			const previous = this.dueDateAtOccurrence(schedule, index - 1);
			if (previous !== undefined && previous >= date) {
				index -= 1;
				dueDate = previous;
			} else {
				break;
			}
		}

		return dueDate === undefined ? undefined : index;
	}

	private static validateDefinition(schedule: ScheduledTransaction): void {
		if (!Transaction.isKind(schedule.kind)) {
			throw new ScheduledTransactionKindInvalidError();
		}
		if (!Number.isSafeInteger(schedule.amountMinor) || schedule.amountMinor <= 0) {
			throw new ScheduledTransactionAmountInvalidError();
		}
		if (!/^[A-Z]{3}$/u.test(schedule.currencyCode)) {
			throw new ScheduledTransactionCurrencyInvalidError();
		}
		if (schedule.description.length > DESCRIPTION_MAX_LENGTH) {
			throw new ScheduledTransactionDescriptionTooLongError(DESCRIPTION_MAX_LENGTH);
		}
		if (!CalendarDate.isValid(schedule.startDate)) {
			throw new ScheduledTransactionStartDateInvalidError();
		}
		if (!this.isFrequency(schedule.frequency)) {
			throw new ScheduledTransactionFrequencyInvalidError();
		}
		if (
			!Number.isSafeInteger(schedule.interval) ||
			schedule.interval < 1 ||
			schedule.interval > SCHEDULED_TRANSACTION_INTERVAL_MAX
		) {
			throw new ScheduledTransactionIntervalInvalidError(SCHEDULED_TRANSACTION_INTERVAL_MAX);
		}
		if (schedule.frequency === SCHEDULED_TRANSACTION_FREQUENCY.ONCE && schedule.interval !== 1) {
			throw new ScheduledTransactionIntervalInvalidError(1);
		}
		if (schedule.endDate !== null) {
			if (!CalendarDate.isValid(schedule.endDate)) {
				throw new ScheduledTransactionEndDateInvalidError();
			}
			if (schedule.endDate < schedule.startDate) {
				throw new ScheduledTransactionDateRangeInvalidError();
			}
			if (schedule.frequency === SCHEDULED_TRANSACTION_FREQUENCY.ONCE) {
				throw new ScheduledTransactionEndDateInvalidError();
			}
		}
		if (!this.isPostingMode(schedule.postingMode)) {
			throw new ScheduledTransactionPostingModeInvalidError();
		}
		if (!this.isStatus(schedule.status)) {
			throw new ScheduledTransactionStatusInvalidError();
		}
		if (!Number.isSafeInteger(schedule.occurrenceNumber) || schedule.occurrenceNumber < 0) {
			throw new ScheduledTransactionStateInvalidError();
		}
		if (!Number.isSafeInteger(schedule.version) || schedule.version < 0) {
			throw new ScheduledTransactionStateInvalidError();
		}
	}

	private static validateState(schedule: ScheduledTransaction): void {
		if (schedule.status === SCHEDULED_TRANSACTION_STATUS.COMPLETED) {
			if (schedule.nextDueDate !== null) {
				throw new ScheduledTransactionStateInvalidError();
			}

			return;
		}
		if (schedule.nextDueDate === null || !CalendarDate.isValid(schedule.nextDueDate)) {
			throw new ScheduledTransactionStateInvalidError();
		}
		const expected = this.dueDateAtOccurrence(schedule, schedule.occurrenceNumber);
		if (expected !== schedule.nextDueDate) {
			throw new ScheduledTransactionStateInvalidError();
		}
	}

	advance(): ScheduledTransaction {
		if (this.status !== SCHEDULED_TRANSACTION_STATUS.ACTIVE) {
			throw new ScheduledTransactionTransitionError('advance', this.status);
		}
		const occurrenceNumber = this.occurrenceNumber + 1;
		const nextDueDate = ScheduledTransaction.dueDateAtOccurrence(this, occurrenceNumber);

		return ScheduledTransaction.restore({
			...this.toProperties(),
			nextDueDate: nextDueDate ?? null,
			occurrenceNumber,
			status:
				nextDueDate === undefined
					? SCHEDULED_TRANSACTION_STATUS.COMPLETED
					: SCHEDULED_TRANSACTION_STATUS.ACTIVE,
			version: this.version + 1,
		});
	}

	assertDue(today: string): void {
		if (!this.isDue(today)) {
			throw new ScheduledTransactionNotDueError(this.id, this.nextDueDate);
		}
	}

	isDue(today: string): boolean {
		return (
			this.status === SCHEDULED_TRANSACTION_STATUS.ACTIVE &&
			this.nextDueDate !== null &&
			this.nextDueDate <= today
		);
	}

	pause(): ScheduledTransaction {
		if (this.status !== SCHEDULED_TRANSACTION_STATUS.ACTIVE) {
			throw new ScheduledTransactionTransitionError('pause', this.status);
		}

		return ScheduledTransaction.restore({
			...this.toProperties(),
			status: SCHEDULED_TRANSACTION_STATUS.PAUSED,
			version: this.version + 1,
		});
	}

	projectOccurrences(
		fromDate: string,
		toDate: string,
		maxOccurrences = SCHEDULED_TRANSACTION_MAX_PROJECTED_OCCURRENCES
	): ScheduledOccurrence[] {
		if (!CalendarDate.isValid(fromDate) || !CalendarDate.isValid(toDate) || fromDate > toDate) {
			throw new ScheduledTransactionProjectionRangeInvalidError();
		}
		if (
			!Number.isSafeInteger(maxOccurrences) ||
			maxOccurrences < 1 ||
			maxOccurrences > SCHEDULED_TRANSACTION_MAX_PROJECTED_OCCURRENCES
		) {
			throw new ScheduledTransactionProjectionLimitInvalidError(SCHEDULED_TRANSACTION_MAX_PROJECTED_OCCURRENCES);
		}
		const firstIndex = ScheduledTransaction.occurrenceIndexOnOrAfter(this, fromDate, this.occurrenceNumber);
		if (firstIndex === undefined) {
			return [];
		}
		const occurrences: ScheduledOccurrence[] = [];
		let occurrenceNumber = firstIndex;
		let dueDate = ScheduledTransaction.dueDateAtOccurrence(this, occurrenceNumber);
		while (dueDate !== undefined && dueDate <= toDate && occurrences.length < maxOccurrences) {
			occurrences.push({ dueDate, occurrenceNumber });
			occurrenceNumber += 1;
			dueDate = ScheduledTransaction.dueDateAtOccurrence(this, occurrenceNumber);
		}

		return occurrences;
	}

	resume(today: string): ScheduledTransaction {
		if (this.status !== SCHEDULED_TRANSACTION_STATUS.PAUSED) {
			throw new ScheduledTransactionTransitionError('resume', this.status);
		}
		if (this.nextDueDate !== null && this.nextDueDate >= today) {
			return ScheduledTransaction.restore({
				...this.toProperties(),
				status: SCHEDULED_TRANSACTION_STATUS.ACTIVE,
				version: this.version + 1,
			});
		}
		const first = ScheduledTransaction.firstOccurrenceOnOrAfter(this, today, this.occurrenceNumber);
		if (first === undefined) {
			return ScheduledTransaction.restore({
				...this.toProperties(),
				nextDueDate: null,
				status: SCHEDULED_TRANSACTION_STATUS.COMPLETED,
				version: this.version + 1,
			});
		}

		return ScheduledTransaction.restore({
			...this.toProperties(),
			nextDueDate: first.dueDate,
			occurrenceNumber: first.occurrenceNumber,
			status: SCHEDULED_TRANSACTION_STATUS.ACTIVE,
			version: this.version + 1,
		});
	}

	update(changes: ScheduledTransactionChanges, today: string): ScheduledTransaction {
		if (this.status === SCHEDULED_TRANSACTION_STATUS.COMPLETED) {
			throw new ScheduledTransactionCompletedError(this.id);
		}
		const frequency = changes.frequency ?? this.frequency;
		const interval = frequency === SCHEDULED_TRANSACTION_FREQUENCY.ONCE ? 1 : (changes.interval ?? this.interval);
		const endDate =
			frequency === SCHEDULED_TRANSACTION_FREQUENCY.ONCE
				? null
				: 'endDate' in changes
					? changes.endDate
					: this.endDate;
		const candidate = ScheduledTransaction.createInstance({
			...this.toProperties(),
			amountMinor: changes.amountMinor ?? this.amountMinor,
			categoryId: changes.categoryId === undefined ? this.categoryId : changes.categoryId,
			description: changes.description ?? this.description,
			endDate: endDate ?? null,
			frequency,
			interval,
			kind: changes.kind ?? this.kind,
			postingMode: changes.postingMode ?? this.postingMode,
			startDate: changes.startDate ?? this.startDate,
		});
		const isRecurrenceChanged =
			candidate.startDate !== this.startDate ||
			candidate.frequency !== this.frequency ||
			candidate.interval !== this.interval;
		if (isRecurrenceChanged) {
			const first = ScheduledTransaction.firstOccurrenceOnOrAfter(candidate, today, 0);
			if (first === undefined) {
				return ScheduledTransaction.restore({
					...candidate.toProperties(),
					nextDueDate: null,
					occurrenceNumber: 0,
					status: SCHEDULED_TRANSACTION_STATUS.COMPLETED,
					version: this.version + 1,
				});
			}

			return ScheduledTransaction.restore({
				...candidate.toProperties(),
				nextDueDate: first.dueDate,
				occurrenceNumber: first.occurrenceNumber,
				status:
					candidate.status === SCHEDULED_TRANSACTION_STATUS.PAUSED
						? SCHEDULED_TRANSACTION_STATUS.PAUSED
						: SCHEDULED_TRANSACTION_STATUS.ACTIVE,
				version: this.version + 1,
			});
		}
		if (candidate.endDate !== this.endDate) {
			if (
				candidate.nextDueDate !== null &&
				candidate.endDate !== null &&
				candidate.nextDueDate > candidate.endDate
			) {
				return ScheduledTransaction.restore({
					...candidate.toProperties(),
					nextDueDate: null,
					occurrenceNumber: 0,
					status: SCHEDULED_TRANSACTION_STATUS.COMPLETED,
					version: this.version + 1,
				});
			}

			return ScheduledTransaction.restore({
				...candidate.toProperties(),
				version: this.version + 1,
			});
		}

		return ScheduledTransaction.restore({
			...candidate.toProperties(),
			version: this.version + 1,
		});
	}

	private toProperties(): ScheduledTransactionProperties {
		return {
			amountMinor: this.amountMinor,
			categoryId: this.categoryId,
			createdAt: this.createdAt,
			createdBy: this.createdBy,
			currencyCode: this.currencyCode,
			description: this.description,
			endDate: this.endDate,
			frequency: this.frequency,
			id: this.id,
			interval: this.interval,
			kind: this.kind,
			nextDueDate: this.nextDueDate,
			occurrenceNumber: this.occurrenceNumber,
			postingMode: this.postingMode,
			startDate: this.startDate,
			status: this.status,
			version: this.version,
		};
	}
}

export {
	type CreateScheduledTransactionProperties,
	SCHEDULED_TRANSACTION_FREQUENCIES,
	SCHEDULED_TRANSACTION_FREQUENCY,
	SCHEDULED_TRANSACTION_INTERVAL_MAX,
	SCHEDULED_TRANSACTION_MAX_PROJECTED_OCCURRENCES,
	SCHEDULED_TRANSACTION_POSTING_MODE,
	SCHEDULED_TRANSACTION_POSTING_MODES,
	SCHEDULED_TRANSACTION_STATUS,
	SCHEDULED_TRANSACTION_STATUSES,
	type ScheduledOccurrence,
	ScheduledTransaction,
	type ScheduledTransactionChanges,
	type ScheduledTransactionFrequency,
	type ScheduledTransactionPostingMode,
	type ScheduledTransactionProperties,
	type ScheduledTransactionStatus,
};
