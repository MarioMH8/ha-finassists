const OCCURRENCE_STATUS = {
	PENDING: 'pending',
	RECORDED: 'recorded',
	SKIPPED: 'skipped',
} as const;

type OccurrenceStatus = (typeof OCCURRENCE_STATUS)[keyof typeof OCCURRENCE_STATUS];

interface ScheduleOccurrence {
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

interface LedgerTransactionReference {
	accountId: string;
	amountMinor: number;
	bookId: string;
	id: string;
}

function createScheduleOccurrence(
	schedule: ScheduledPaymentSnapshot,
	occurrenceNumber: number,
	dueDate: string,
	id: string,
	createdAt = new Date().toISOString()
): ScheduleOccurrence {
	if (!Number.isSafeInteger(occurrenceNumber) || occurrenceNumber < 0) {
		throw new Error('Occurrence number must be a non-negative safe integer');
	}
	if (!Number.isSafeInteger(schedule.amountMinor) || schedule.amountMinor === 0) {
		throw new Error('Occurrence amount must be a non-zero safe integer');
	}
	if (!id.trim() || !isCalendarDate(dueDate)) {
		throw new Error('Occurrence id and due date must be valid');
	}

	return {
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
	};
}

interface ScheduledPaymentSnapshot {
	accountId: string;
	amountMinor: number;
	bookId: string;
	id: string;
	memo: string;
	payee: string;
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

export {
	createScheduleOccurrence,
	type LedgerTransactionReference,
	OCCURRENCE_STATUS,
	type OccurrenceStatus,
	type ScheduleOccurrence,
};
