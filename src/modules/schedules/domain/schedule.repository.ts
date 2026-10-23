import type { ScheduledPayment } from './schedule';

interface ScheduleRepository {
	create(schedule: ScheduledPayment): void;
	find(bookId: string, id: string): ScheduledPayment | undefined;
	list(bookId: string): ScheduledPayment[];
	update(schedule: ScheduledPayment): boolean;
}

export type { ScheduleRepository };
