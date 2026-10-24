import type { OccurrenceStatus, ScheduleOccurrence } from '@modules/schedules/domain/schedule-occurrence';

interface ScheduleOccurrenceCriteria {
	accountId?: string;
	amountMinor?: number;
	bookId?: string;
	createdAt?: string;
	dueDate?: string;
	id?: string;
	memo?: string;
	occurrenceNumber?: number;
	payee?: string;
	recordedAt?: null | string;
	scheduleId?: string;
	status?: OccurrenceStatus;
	transactionId?: null | string;
}

interface ScheduleOccurrenceRepository {
	find(criteria: ScheduleOccurrenceCriteria): ScheduleOccurrence | undefined;
	save(occurrence: ScheduleOccurrence): void;
	search(criteria?: ScheduleOccurrenceCriteria): ScheduleOccurrence[];
}

export type { ScheduleOccurrenceCriteria, ScheduleOccurrenceRepository };
