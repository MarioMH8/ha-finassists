import { ScheduledPaymentMother } from './schedule.mother';
import { ScheduleOccurrence } from './schedule-occurrence';

class ScheduleOccurrenceMother {
	static create(
		schedule = ScheduledPaymentMother.create(),
		occurrenceNumber = 0,
		id = 'occurrence-1'
	): ScheduleOccurrence {
		return ScheduleOccurrence.create(schedule, occurrenceNumber, id, '2025-01-01T00:00:00.000Z');
	}
}

export { ScheduleOccurrenceMother };
