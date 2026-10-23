import { ScheduledPayment } from './schedule';
import {
	ScheduleOccurrenceAmountInvalidError,
	ScheduleOccurrenceDateInvalidError,
	ScheduleOccurrenceIdentityInvalidError,
	ScheduleOccurrenceNumberInvalidError,
	ScheduleOccurrenceRecordInvalidError,
	ScheduleOccurrenceStatusInvalidError,
	ScheduleOccurrenceTransitionInvalidError,
	ScheduleOccurrenceUnavailableError,
} from './schedule-occurrence.error';

const OCCURRENCE_STATUS = {
	PENDING: 'pending',
	RECORDED: 'recorded',
	SKIPPED: 'skipped',
} as const;

type OccurrenceStatus = (typeof OCCURRENCE_STATUS)[keyof typeof OCCURRENCE_STATUS];

interface LedgerTransactionReference {
	accountId: string;
	amountMinor: number;
	bookId: string;
	id: string;
}

interface ScheduleOccurrenceProperties {
	accountId: string;
	amountMinor: number;
	bookId: string;
	createdAt: string;
	dueDate: string;
	id: string;
	memo: string;
	occurrenceNumber: number;
	payee: string;
	recordedAt?: string;
	scheduleId: string;
	status: OccurrenceStatus;
	transactionId?: string;
}

class ScheduleOccurrence {
	readonly accountId: string;
	readonly amountMinor: number;
	readonly bookId: string;
	readonly createdAt: string;
	readonly dueDate: string;
	readonly id: string;
	readonly memo: string;
	readonly occurrenceNumber: number;
	readonly payee: string;
	readonly recordedAt?: string;
	readonly scheduleId: string;
	readonly status: OccurrenceStatus;
	readonly transactionId?: string;

	private constructor(properties: ScheduleOccurrenceProperties) {
		this.accountId = properties.accountId;
		this.amountMinor = properties.amountMinor;
		this.bookId = properties.bookId;
		this.createdAt = properties.createdAt;
		this.dueDate = properties.dueDate;
		this.id = properties.id;
		this.memo = properties.memo;
		this.occurrenceNumber = properties.occurrenceNumber;
		this.payee = properties.payee;
		this.recordedAt = properties.recordedAt;
		this.scheduleId = properties.scheduleId;
		this.status = properties.status;
		this.transactionId = properties.transactionId;
	}

	static create(
		schedule: ScheduledPayment,
		occurrenceNumber: number,
		id: string,
		createdAt = new Date().toISOString()
	): ScheduleOccurrence {
		const dueDate = schedule.dueDateAtOccurrence(occurrenceNumber);
		if (dueDate === undefined) {
			throw new ScheduleOccurrenceUnavailableError();
		}

		return this.restore({
			accountId: schedule.accountId,
			amountMinor: schedule.amountMinor,
			bookId: schedule.bookId,
			createdAt,
			dueDate,
			id,
			memo: schedule.memo,
			occurrenceNumber,
			payee: schedule.payee,
			scheduleId: schedule.id,
			status: OCCURRENCE_STATUS.PENDING,
		});
	}

	static restore(properties: ScheduleOccurrenceProperties): ScheduleOccurrence {
		const occurrence = new this(properties);
		this.validate(occurrence);

		return occurrence;
	}

	private static validate(occurrence: ScheduleOccurrence): void {
		if (
			!occurrence.id.trim() ||
			!occurrence.bookId.trim() ||
			!occurrence.scheduleId.trim() ||
			!occurrence.accountId.trim()
		) {
			throw new ScheduleOccurrenceIdentityInvalidError();
		}
		if (!Number.isSafeInteger(occurrence.occurrenceNumber) || occurrence.occurrenceNumber < 0) {
			throw new ScheduleOccurrenceNumberInvalidError();
		}
		if (!Number.isSafeInteger(occurrence.amountMinor) || occurrence.amountMinor === 0) {
			throw new ScheduleOccurrenceAmountInvalidError();
		}
		if (!isCalendarDate(occurrence.dueDate)) {
			throw new ScheduleOccurrenceDateInvalidError();
		}
		if (!Object.values(OCCURRENCE_STATUS).includes(occurrence.status)) {
			throw new ScheduleOccurrenceStatusInvalidError();
		}
		if (
			occurrence.status === OCCURRENCE_STATUS.RECORDED &&
			(!occurrence.transactionId?.trim() || !occurrence.recordedAt?.trim())
		) {
			throw new ScheduleOccurrenceRecordInvalidError();
		}
		if (
			occurrence.status !== OCCURRENCE_STATUS.RECORDED &&
			(occurrence.transactionId !== undefined || occurrence.recordedAt !== undefined)
		) {
			throw new ScheduleOccurrenceRecordInvalidError();
		}
	}

	record(transaction: LedgerTransactionReference, recordedAt: string): ScheduleOccurrence {
		if (
			transaction.bookId !== this.bookId ||
			transaction.accountId !== this.accountId ||
			transaction.amountMinor !== this.amountMinor
		) {
			throw new ScheduleOccurrenceRecordInvalidError();
		}
		if (this.status === OCCURRENCE_STATUS.RECORDED && this.transactionId === transaction.id) {
			return this;
		}
		if (this.status !== OCCURRENCE_STATUS.PENDING || !transaction.id.trim() || !recordedAt.trim()) {
			throw new ScheduleOccurrenceRecordInvalidError();
		}

		return ScheduleOccurrence.restore({
			accountId: this.accountId,
			amountMinor: this.amountMinor,
			bookId: this.bookId,
			createdAt: this.createdAt,
			dueDate: this.dueDate,
			id: this.id,
			memo: this.memo,
			occurrenceNumber: this.occurrenceNumber,
			payee: this.payee,
			recordedAt,
			scheduleId: this.scheduleId,
			status: OCCURRENCE_STATUS.RECORDED,
			transactionId: transaction.id,
		});
	}

	skip(): ScheduleOccurrence {
		if (this.status !== OCCURRENCE_STATUS.PENDING) {
			throw new ScheduleOccurrenceTransitionInvalidError(this.status);
		}

		return ScheduleOccurrence.restore({
			accountId: this.accountId,
			amountMinor: this.amountMinor,
			bookId: this.bookId,
			createdAt: this.createdAt,
			dueDate: this.dueDate,
			id: this.id,
			memo: this.memo,
			occurrenceNumber: this.occurrenceNumber,
			payee: this.payee,
			scheduleId: this.scheduleId,
			status: OCCURRENCE_STATUS.SKIPPED,
		});
	}
}

function isCalendarDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}
	const year = Number(value.slice(0, 4));
	const month = Number(value.slice(5, 7));
	const day = Number(value.slice(8, 10));
	const date = new Date(`${value}T00:00:00.000Z`);

	return (
		year > 0 &&
		month >= 1 &&
		month <= 12 &&
		day >= 1 &&
		date.getUTCFullYear() === year &&
		date.getUTCMonth() + 1 === month &&
		date.getUTCDate() === day
	);
}

export { type LedgerTransactionReference, OCCURRENCE_STATUS, type OccurrenceStatus, ScheduleOccurrence };
