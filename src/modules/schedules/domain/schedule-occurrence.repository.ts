import type { ScheduleOccurrence } from './schedule-occurrence';

interface ScheduleOccurrenceRepository {
	createIfAbsent(occurrence: ScheduleOccurrence): boolean;
	find(bookId: string, id: string): ScheduleOccurrence | undefined;
	linkTransaction(occurrence: ScheduleOccurrence): ScheduleOccurrence | undefined;
	listForSchedule(bookId: string, scheduleId: string): ScheduleOccurrence[];
}

export type { ScheduleOccurrenceRepository };
