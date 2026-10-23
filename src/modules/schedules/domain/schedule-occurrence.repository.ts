import type { LedgerTransactionReference, ScheduleOccurrence } from './schedule-occurrence';

interface ScheduleOccurrenceRepository {
	createIfAbsent(occurrence: ScheduleOccurrence): boolean;
	find(bookId: string, id: string): ScheduleOccurrence | undefined;
	linkTransaction(
		bookId: string,
		occurrenceId: string,
		transaction: LedgerTransactionReference,
		recordedAt: string
	): ScheduleOccurrence | undefined;
	listForSchedule(bookId: string, scheduleId: string): ScheduleOccurrence[];
}

export type { ScheduleOccurrenceRepository };
